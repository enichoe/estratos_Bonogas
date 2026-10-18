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
 window.geoBonoStartGPS=()=>locateButton.click();
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

// El visor ArcGIS externo está aislado en un iframe: no se puede controlar su GPS
// ni consultar sus capas desde GeoBonoGas sin una API o permisos del propietario.
(() => {
 const own=document.getElementById('tabGeo'),external=document.getElementById('tabExternal');
 const map=document.getElementById('viewDiv'),panel=document.getElementById('externalPanel');
 const frame=document.getElementById('externalFrame');
 function switchTab(showExternal){
   own.classList.toggle('active',!showExternal);external.classList.toggle('active',showExternal);
   own.setAttribute('aria-pressed',String(!showExternal));external.setAttribute('aria-pressed',String(showExternal));
   map.hidden=showExternal;panel.hidden=!showExternal;
   if(showExternal&&!frame.src)frame.src=frame.dataset.src;
   // El visor propio sigue montado y conserva su estado al regresar.
 }
 own.addEventListener('click',()=>switchTab(false));
 external.addEventListener('click',()=>switchTab(true));
})();

// Panel móvil y acceso al seguimiento desde la pestaña externa.
(() => {
 const sidebar=document.getElementById('sidebar');
 const toggle=document.getElementById('sidebarToggle');
 toggle.addEventListener('click',()=>{
   const open=sidebar.classList.toggle('is-open');
   toggle.setAttribute('aria-expanded',String(open));
   toggle.textContent=open?'✕ Cerrar panel':'☰ Capas y GPS';
 });
 document.getElementById('externalGps').addEventListener('click',()=>{
   // Los iframes de otro origen no permiten centrar su mapa por JavaScript.
   // Cambiamos al mapa controlado por GeoBonoGas y activamos allí el GPS.
   document.getElementById('tabGeo').click();
   window.geoBonoStartGPS?.();
   document.getElementById('externalGpsStatus').textContent='Seguimiento iniciado en GeoBonoGas.';
 });
})();

// Autenticación obligatoria previa para el acceso a GeoBonoGas
(() => {
  const REQUIRED_USER = 'enichoe@gmail.com';
  const REQUIRED_PASS = 'ArribaAlianza@';
  const AUTH_KEY = 'geobonogas_auth_session';

  const overlay = document.getElementById('loginOverlay');
  const form = document.getElementById('loginForm');
  const emailInput = document.getElementById('loginEmail');
  const passInput = document.getElementById('loginPassword');
  const errorBox = document.getElementById('loginError');
  const togglePassBtn = document.getElementById('togglePassword');
  const userSession = document.getElementById('userSession');
  const logoutBtn = document.getElementById('logoutBtn');

  function setAuthenticated(isAuth) {
    if (isAuth) {
      if (overlay) overlay.style.display = 'none';
      if (userSession) userSession.style.display = 'flex';
    } else {
      if (overlay) overlay.style.display = 'flex';
      if (userSession) userSession.style.display = 'none';
      if (passInput) passInput.value = '';
      if (errorBox) {
        errorBox.style.display = 'none';
        errorBox.textContent = '';
      }
      setTimeout(() => emailInput?.focus(), 100);
    }
  }

  // Verificar estado al cargar
  const hasSession = sessionStorage.getItem(AUTH_KEY) === 'true';
  setAuthenticated(hasSession);

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const enteredEmail = (emailInput.value || '').trim().toLowerCase();
      const enteredPass = passInput.value || '';

      if (enteredEmail === REQUIRED_USER.toLowerCase() && enteredPass === REQUIRED_PASS) {
        sessionStorage.setItem(AUTH_KEY, 'true');
        setAuthenticated(true);
      } else {
        if (errorBox) {
          errorBox.textContent = 'Usuario o contraseña incorrectos. Verifique sus credenciales.';
          errorBox.style.display = 'block';
        }
        if (passInput) {
          passInput.value = '';
          passInput.focus();
        }
      }
    });
  }

  if (togglePassBtn && passInput) {
    togglePassBtn.addEventListener('click', () => {
      const isPass = passInput.type === 'password';
      passInput.type = isPass ? 'text' : 'password';
      togglePassBtn.textContent = isPass ? '🙈' : '👁️';
      togglePassBtn.setAttribute('aria-label', isPass ? 'Ocultar contraseña' : 'Mostrar contraseña');
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      sessionStorage.removeItem(AUTH_KEY);
      setAuthenticated(false);
    });
  }
})();
