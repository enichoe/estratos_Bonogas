# GeoBonoGas — prototipo etapa 1

## Inicio
1. Abre esta carpeta en VS Code.
2. Instala la extensión Live Server o ejecuta `python -m http.server 5500` desde esta carpeta.
3. Abre `http://localhost:5500`.
4. Comprueba los mensajes del panel de servicios y la consola (F12).

## Notas
- La cartografía base requiere Internet y puede tener condiciones de uso o autenticación de Esri.
- Las URL de Cálidda y Osinergmin son servicios externos. Su disponibilidad, permisos de uso y acceso CORS no están garantizados.
- La visualización de estratos requiere identificar las subcapas, fechas y campos apropiados. Este prototipo agrega el MapServer general y no aplica aún simbología socioeconómica propia.
- No muestra cobertura certificada ni elegibilidad BonoGas.
- No almacena información de personas ni direcciones consultadas.


## Seguimiento GPS (etapa 1.1)
Pulsa «Activar seguimiento» y permite la ubicación. El mapa se centra al caminar y consulta el servicio de estratos aproximadamente cada 8 segundos cuando te desplazas al menos 10 metros. El punto azul indica posición aproximada; la precisión depende del dispositivo. Pulsa «Detener» para apagar el seguimiento.

IMPORTANTE: en celulares se requiere HTTPS (por ejemplo, despliegue en Vercel); localhost también es válido. En una URL http:// con IP de red local el navegador puede bloquear GPS. Mantén la pestaña abierta y en primer plano; navegadores pueden suspender GPS en segundo plano. Los datos de estratos provienen del GIS publicado, NO se actualizan en tiempo real: lo que se actualiza es tu ubicación y la consulta. La consulta depende de que el servidor permita Identify/CORS y de que haya capas y datos disponibles. No certifica elegibilidad.

## Visor ArcGIS adicional (etapa 1.2)
La pestaña «Visor ArcGIS adicional» integra la aplicación indicada por el usuario mediante un iframe. Se ofrece un enlace para abrirla directamente si ArcGIS o el publicador impiden mostrarla dentro de otra web. Su contenido y sus permisos no están bajo el control de GeoBonoGas. El GPS y la consulta de estratos del proyecto funcionan en la pestaña «GeoBonoGas + GPS», no dentro del visor externo. Se añadió el footer «Desarrollado por ED TECH».


## Versión 1.3: uso móvil y GPS
- En pantallas de hasta 700 px, pulsa **☰ Capas y GPS** para abrir/cerrar el panel lateral.
- La pestaña del visor ArcGIS adicional es un iframe de un sitio de terceros: **no es posible controlar su centro, su GPS ni consultar sus capas** desde nuestra aplicación sin acceso a su WebMap/servicios y permisos adecuados.
- Por eso el botón **Seguir mi ubicación** de la pestaña externa abre el mapa propio GeoBonoGas y activa el seguimiento allí; **no** posiciona el visor externo.
- Para seguimiento GPS con las capas del visor adicional dentro de un solo mapa es necesario identificar su WebMap y las URL de sus capas, y confirmar que el servidor permite su uso.
- Para ubicación en teléfonos, publicar mediante HTTPS y autorizar geolocalización.
