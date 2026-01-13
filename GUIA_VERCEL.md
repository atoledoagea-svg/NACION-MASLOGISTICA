# Guía para Desplegar en Vercel

## ✅ Tu proyecto ya está configurado para Vercel

Tu proyecto tiene:
- ✅ Carpeta `api/` con funciones serverless
- ✅ Carpeta `public/` con archivos estáticos
- ✅ Archivo `vercel.json` configurado
- ✅ `package.json` con todas las dependencias

## 🚀 Opción 1: Desde el Dashboard de Vercel (Recomendado)

### Paso 1: Preparar el repositorio
```bash
# Asegúrate de tener todos los cambios guardados
git add .
git commit -m "Preparado para Vercel"
git push
```

### Paso 2: Conectar con Vercel
1. Ve a [vercel.com](https://vercel.com) e inicia sesión (o crea una cuenta)
2. Haz clic en **"Add New Project"** o **"New Project"**
3. Conecta tu repositorio de GitHub/GitLab/Bitbucket
4. Selecciona el repositorio `web3`

### Paso 3: Configuración del Proyecto
Vercel detectará automáticamente:
- **Framework Preset**: Otro (Node.js)
- **Root Directory**: `./` (raíz del proyecto)
- **Build Command**: (dejar vacío - no necesitas build)
- **Output Directory**: (dejar vacío - Vercel detecta `public/` automáticamente)
- **Install Command**: `npm install` (automático)

### Paso 4: Desplegar
1. Haz clic en **"Deploy"**
2. Espera a que termine el despliegue (2-3 minutos)
3. ¡Listo! Tu app estará en `https://tu-proyecto.vercel.app`

---

## 🚀 Opción 2: Desde la CLI de Vercel

### Paso 1: Instalar Vercel CLI
```bash
npm install -g vercel
```

### Paso 2: Iniciar sesión
```bash
vercel login
```

### Paso 3: Desplegar
```bash
# Desde la raíz del proyecto (D:\web3)
vercel
```

Sigue las instrucciones:
- **Set up and deploy?** → `Y`
- **Which scope?** → Selecciona tu cuenta
- **Link to existing project?** → `N` (primera vez)
- **Project name?** → Presiona Enter (usa el nombre por defecto)
- **Directory?** → Presiona Enter (usa `./`)
- **Override settings?** → `N`

### Paso 4: Desplegar a producción
```bash
vercel --prod
```

---

## 📁 Estructura que Vercel detecta automáticamente

```
.
├── api/              ← Funciones serverless (automático)
│   └── process.js
├── public/           ← Archivos estáticos (automático)
│   ├── index.html
│   ├── dashboard.html
│   └── ...
├── backend/          ← Código compartido
├── vercel.json       ← Configuración de Vercel
└── package.json      ← Dependencias Node.js
```

## 🔍 Verificar el despliegue

Después del despliegue, verifica:

1. **Frontend**: `https://tu-proyecto.vercel.app/`
   - Debería mostrar la pantalla de selección

2. **API**: `https://tu-proyecto.vercel.app/api/process`
   - Debería estar disponible (solo acepta POST)

## ⚙️ Configuración Actual

Tu `vercel.json` está configurado con:
- **Timeout**: 60 segundos para funciones serverless
- **Rutas**: Automáticas (Vercel detecta `api/` y `public/`)

## 🐛 Solución de Problemas

### Error: "Module not found"
- Verifica que todas las dependencias estén en `package.json`
- Asegúrate de que `npm install` se ejecute correctamente

### Error: "Function timeout"
- El timeout está configurado a 60 segundos
- Si necesitas más tiempo, edita `vercel.json`:
```json
{
  "functions": {
    "api/**/*.js": {
      "maxDuration": 120
    }
  }
}
```

### Los archivos estáticos no cargan
- Verifica que la carpeta se llame exactamente `public/`
- Verifica que los archivos estén dentro de `public/`

### La API no funciona
- Revisa los logs en Vercel → Functions → Logs
- Verifica que `busboy` esté instalado: `npm install busboy`

## 📝 Notas Importantes

1. **Archivos temporales**: En Vercel se usa `/tmp` (ya configurado)
2. **Variables de entorno**: Si necesitas alguna, agrégalas en Vercel → Settings → Environment Variables
3. **Dominio personalizado**: Puedes configurarlo en Vercel → Settings → Domains

## 🔄 Actualizaciones Futuras

Cada vez que hagas `git push`, Vercel:
- Detectará los cambios automáticamente
- Creará un nuevo deployment
- Te notificará cuando esté listo

¡Listo para desplegar! 🎉

