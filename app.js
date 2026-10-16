/* GeoBonoGas: configuración de fuentes, sin credenciales en el navegador. */
const SOURCES = [
  {id:'calidda',name:'Cálidda',url:'https://gis.calidda.com.pe/arcgis/rest/services/calidda_gis_v_new/MapServer'},
  {id:'estratos',name:'Estratos INEI / Osinergmin',url:'https://gisem.osinergmin.gob.pe/serverosih/rest/services/agol_inei_2020_lima_total_MIL1/MapServer'}
];
require(['esri/Map','esri/views/MapView','esri/layers/MapImageLayer','esri/widgets/Legend','esri/widgets/Expand','esri/request','esri/Graphic','esri/geometry/Point','esri/rest/identify','esri/rest/support/IdentifyParameters'],(Map,MapView,MapImageLayer,Legend,Expand,esriRequest,Graphic,Point,identify,IdentifyParameters)=>{
 const map=new Map({basemap:'streets-vector'});
 const view=new MapView({container:'viewDiv',map,center:[-77.0428,-12.0464],zoom:11,popup:{dockEnabled:true,dockOptions:{breakpoint:false,position:'bottom-right'}}});
 const status=document.getElementById('status');const layers={};
 const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const update=()=>{status.innerHTML=SOURCES.map(s=>`<div><strong>${escapeHtml(s.name)}</strong>: <span class="${layers[s.id]?.state||'pending'}">${escapeHtml(layers[s.id]?.message||'Pendiente')}</span></div>`).join('')};
 async function connect(s){
   const old=layers[s.id]?.layer;if(old)map.remove(old);
   layers[s.id]={state:'pending',message:'Conectando…'};update();
   try{
     // Verifica metadatos antes de cargar el servicio: fallos CORS, permisos o servidor se informan.
     const metadata=await esriRequest(s.url,{query:{f:'json'},responseType:'json',timeout:15000});
     if(metadata.data?.error)throw new Error(metadata.data.error.message||'Error ArcGIS');
     const layer=new MapImageLayer({url:s.url,title:s.name,visible:document.getElementById(s.id).checked});
     map.add(layer);await layer.load();
     layers[s.id]={layer,state:'ok',message:`Conectado (${(metadata.data.layers||[]).length} subcapas declaradas)`};
   }catch(e){layers[s.id]={state:'error',message:`No disponible: ${e.message||e}. Revisa permisos, CORS y acceso al servicio.`};console.warn(s.name,e)}update();
 }
 SOURCES.forEach(s=>{document.getElementById(s.id).addEventListener('change',e=>{if(layers[s.id]?.layer)layers[s.id].layer.visible=e.target.checked});connect(s)});
 document.getElementById('refresh').addEventListener('click',()=>SOURCES.forEach(connect));
 const legend=new Legend({view});view.ui.add(new Expand({view,content:legend,expandIcon:'legend',expanded:false}), 'bottom-left');
 const locateButton=document.getElementById('locate'),stopButton=document.getElementById('stopLocate');
 const locationStatus=document.getElementById('locationStatus'),zoneInfo=document.getElementById('zoneInfo');
 let watchId=null,lastQueryAt=0,lastQueryPosition=null,querySequence=0,follow=true;
 const marker=new Graphic({symbol:{type:'simple-marker',style:'circle',size:13,color:'#1478e8',outline:{color:'#fff',width:3}}});
 function distanceMeters(a,b){const r=Math.PI/180,lat=(a.latitude+b.latitude)*r/2;return Math.hypot((a.latitude-b.latitude)*111195,(a.longitude-b.longitude)*111195*Math.cos(lat));}
 function stopTracking(){if(watchId!==null){navigator.geolocation.clearWatch(watchId);watchId=null;}querySequence++;view.graphics.remove(marker);locateButton.disabled=false;stopButton.disabled=true;locationStatus.textContent='Seguimiento detenido.';}
 async function queryStratum(point,position){
   const sequence=++querySequence;
   const layer=layers.estratos?.layer;
   if(!layer||!document.getElementById('estratos').checked){zoneInfo.textContent='Activa y conecta la capa de estratos para consultar esta ubicación.';return;}
   zoneInfo.textContent='Consultando estrato de la ubicación…';
   try{
     const params=new IdentifyParameters({geometry:point,mapExtent:view.extent,width:view.width,height:view.height,dpi:96,tolerance:3,returnGeometry:false,layerOption:'all'});
     const result=await identify.identify(SOURCES[1].url,params);
     if(sequence!==querySequence||watchId===null)return;
     const items=(result.results||[]).filter(x=>x.feature?.attributes);
     if(!items.length){zoneInfo.textContent='No se encontraron datos de estratificación en este punto. No significa que la zona no tenga estrato.';return;}
     // Mostrar los atributos tal como los entrega la fuente; no inferir elegibilidad BonoGas.
     const chosen=items.find(x=>/2024/i.test(x.layerName||''))||items[0];
     const fields=Object.entries(chosen.feature.attributes).filter(([k,v])=>v!==null&&v!==''&&!/^(objectid|shape|fid)$/i.test(k)).slice(0,12);
     zoneInfo.innerHTML='<strong>Capa: '+escapeHtml(chosen.layerName||'Sin nombre')+'</strong><br>'+fields.map(([k,v])=>'<strong>'+escapeHtml(k)+':</strong> '+escapeHtml(v)).join('<br>')+'<p>Datos referenciales del servicio GIS; no certifican acceso a BonoGas.</p>';
   }catch(e){if(sequence===querySequence)zoneInfo.textContent='No se pudo consultar el estrato: '+(e.message||e);}
 }
 function onPosition(position){
   const {latitude,longitude,accuracy}=position.coords;
   const point=new Point({longitude,latitude,spatialReference:{wkid:4326}});
   marker.geometry=point;if(!view.graphics.includes(marker))view.graphics.add(marker);
   locationStatus.textContent='GPS activo · precisión aproximada: '+Math.round(accuracy)+' m · '+new Date(position.timestamp).toLocaleTimeString('es-PE');
   if(follow)view.goTo({center:point,zoom:Math.max(view.zoom,17)},{animate:false}).catch(()=>{});
   const now=Date.now();if(now-lastQueryAt>=8000&&(!lastQueryPosition||distanceMeters(lastQueryPosition,position.coords)>=10)){
     lastQueryAt=now;lastQueryPosition={latitude,longitude};queryStratum(point,position);
   }
 }
 locateButton.addEventListener('click',()=>{
   if(!navigator.geolocation){locationStatus.textContent='Tu navegador no admite geolocalización.';return;}
   if(!window.isSecureContext){locationStatus.textContent='La ubicación requiere HTTPS o localhost. Abre la web desde un servidor seguro.';return;}
   if(watchId!==null)return;
   follow=true;lastQueryAt=0;lastQueryPosition=null;
   locationStatus.textContent='Solicitando permiso de ubicación…';
   watchId=navigator.geolocation.watchPosition(onPosition,e=>{
     locationStatus.textContent='Error de ubicación: '+e.message;
     if(e.code===1)stopTracking();
   },{enableHighAccuracy:true,maximumAge:2000,timeout:20000});
   locateButton.disabled=true;stopButton.disabled=false;
 });
 stopButton.addEventListener('click',stopTracking);
 view.when(()=>console.info('GeoBonoGas listo')).catch(console.error);
});
