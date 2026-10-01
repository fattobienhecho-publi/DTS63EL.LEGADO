# Conectar formularios con Google Sheets

La pagina envia los formularios a un Google Apps Script. Ese script guarda:

- Donaciones en la pestaña `Donaciones`.
- Bonos en la pestaña `Bonos`.
- Empresas aliadas en la pestaña `Empresas`.
- Comprobantes en una carpeta de Drive llamada `Comprobantes El Legado`.

## Pasos

1. Abre el Google Sheet:
   `https://docs.google.com/spreadsheets/d/1RPn_gZaKxmq4J52021gBsNXQlQFs3KP9SiA4R4YB78o/edit`
2. Entra a `Extensiones > Apps Script`.
3. Borra el contenido inicial y pega el codigo de:
   `legado-site/google-apps-script/Code.gs`
4. Guarda el proyecto.
5. Ve a `Implementar > Nueva implementacion`.
6. Tipo: `Aplicacion web`.
7. Ejecutar como: `Yo`.
8. Quien tiene acceso: `Cualquier usuario`.
9. Autoriza los permisos.
10. Copia la URL de la aplicacion web y pegala en `legado-site/dist/app.js`,
    reemplazando `PENDIENTE_URL_APPS_SCRIPT`.

Despues de reemplazar la URL, los formularios quedan conectados y la barra de meta lee el avance desde la hoja.
