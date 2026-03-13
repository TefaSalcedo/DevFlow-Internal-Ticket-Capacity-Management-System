# Vista de Ventas - Solo Lectura

## Overview

Se ha implementado una nueva vista de **Ventas** con permisos de solo lectura para permitir que los usuarios puedan ver los tickets de otras empresas sin poder crear, modificar o eliminar tickets.

## Características

### 🔍 Modo Solo Lectura
- Los usuarios con rol `READER` pueden ver todos los tickets
- No pueden crear nuevos tickets
- No pueden modificar tickets existentes
- No pueden eliminar tickets
- No pueden asignar o desasignar tickets

### 👥 Roles con Acceso
Tienen acceso a la vista de Ventas:
- `READER` - Rol principal para ventas (solo lectura) - **MENÚ SIMPLIFICADO**
- `TICKET_CREATOR` - Puede ver y también crear tickets
- `MANAGE_TEAM` - Puede ver y gestionar equipos
- `COMPANY_ADMIN` - Acceso completo
- `SUPER_ADMIN` - Acceso completo a todo

### 🎯 Navegación por Rol

#### **Usuarios READER (Solo Lectura)**
- ✅ **Dashboard** - Vista general
- ✅ **Ventas** - Acceso principal a tickets (solo lectura)
- ✅ **Projects** - Ver proyectos
- ✅ **Team** - Ver información del equipo
- ✅ **Calendar** - Ver calendario
- ❌ **Tickets** - No disponible (redirigido a Ventas)

#### **Usuarios con Permisos de Gestión**
- ✅ **Todos los items anteriores** +
- ✅ **Tickets** - Vista completa con gestión
- ✅ **Team Activity** - Si es MANAGE_TEAM o SUPER_ADMIN

### 🎯 Funcionalidades Disponibles
- **Visualización de tickets**: Vista Kanban completa por equipo
- **Filtrado por equipo**: Seleccionar equipo específico para ver sus tickets
- **Navegación por meses**: Ver tickets completados por mes
- **Agrupación por proyecto**: Los tickets se organizan automáticamente por proyecto
- **Información de miembros**: Puede ver quién está asignado a cada ticket

## Configuración

### 1. Asignar Rol READER
Para dar acceso a la vista de ventas a un usuario:

```sql
-- Asignar rol READER a un usuario en una compañía específica
UPDATE company_memberships 
SET role = 'READER' 
WHERE user_id = 'UUID_DEL_USUARIO' 
AND company_id = 'UUID_DE_LA_COMPAÑÍA';
```

### 2. Crear Usuario con Rol READER
```sql
-- Crear nueva membresía con rol READER
INSERT INTO company_memberships (company_id, user_id, role, is_active)
VALUES ('UUID_DE_LA_COMPAÑÍA', 'UUID_DEL_USUARIO', 'READER', true);
```

## Navegación

### Acceso a Ventas
1. Iniciar sesión en la aplicación
2. El menú lateral mostrará la opción **"Ventas"** (icono de ojo)
3. Hacer clic para acceder a la vista de solo lectura

### Diferencias con Vista Normal
| Característica | Vista Normal | Vista Ventas |
|---|---|---|
| Crear tickets | ✅ (si tiene permisos) | ❌ |
| Modificar tickets | ✅ (si tiene permisos) | ❌ |
| Eliminar tickets | ✅ (si tiene permisos) | ❌ |
| Ver tickets | ✅ | ✅ |
| Filtrar por equipo | ✅ | ✅ |
| Navegar por meses | ✅ | ✅ |

## Indicadores Visuales

### 🟡 Modo Solo Lectura
La vista de ventas muestra un indicador amarillo claro que dice:
> "Esta es una vista de solo lectura. No puedes modificar ni crear tickets desde aquí."

### 📍 En el Header
Aparece el texto **"Ventas - Vista de Solo Lectura"** para diferenciarla de la vista normal.

### 🎯 **Experiencia Optimizada para Ventas**
- **Menú simplificado**: Sin opción "Tickets" para evitar confusión
- **Acceso directo**: "Ventas" es la única vía para ver tickets
- **Interfaz limpia**: Enfocada solo en visualización
- **Sin distracciones**: No hay botones de edición que tenten al usuario

## Casos de Uso Típicos

### 🎯 Equipo de Ventas
- Ver el progreso de los proyectos de clientes
- Conocer el estado de los tickets sin poder modificarlos
- Tener visibilidad del trabajo del equipo técnico

### 🤝 Clientes
- Algunos clientes pueden tener acceso limitado para ver sus tickets
- Transparencia en el progreso sin riesgo de modificaciones accidentales

### 📊 Gerentes Externos
- Acceso de supervisión sin capacidades de edición
- Visibilidad completa del trabajo del equipo

## Seguridad

### ✅ Políticas RLS (Row Level Security)
Las políticas en Supabase aseguran que:
- Los usuarios `READER` solo pueden hacer operaciones `SELECT`
- Las operaciones `INSERT`, `UPDATE`, `DELETE` están bloqueadas
- Solo pueden ver tickets de su propia compañía

### 🔐 Validación en Frontend
- La interfaz no muestra botones de crear/editar/eliminar
- El componente `TicketBoard` recibe `canManage={false}`
- **Página `/tickets/new` bloqueada**: Muestra mensaje de "Acceso Restringido" para usuarios READER
- **Botón "+ New Ticket" oculto**: Solo visible para usuarios con permisos de gestión
- Redirección automática si no tiene permisos

### 🛡️ Capas de Seguridad Múltiples
1. **Base de datos (RLS)**: Bloquea operaciones a nivel de Supabase
2. **Frontend (UI)**: Oculta botones y enlaces no permitidos  
3. **Server-side (Next.js)**: Verifica permisos antes de renderizar páginas
4. **Acceso directo**: Intentar acceder a `/tickets/new` sin permisos muestra error

## Troubleshooting

### ❌ "No tienes permisos para acceder a la vista de Ventas"
**Causa**: El usuario no tiene un rol válido en ninguna compañía.
**Solución**: Asignar uno de estos roles: `READER`, `TICKET_CREATOR`, `MANAGE_TEAM`, `COMPANY_ADMIN`.

### ❌ No aparece la opción "Ventas" en el menú
**Causa**: El usuario no tiene ninguno de los roles permitidos.
**Solución**: Verificar que el usuario tenga una membresía activa con rol válido.

### ❌ Puedo ver la página pero no los tickets
**Causa**: El usuario no tiene membresía en la compañía seleccionada.
**Solución**: Asegurar que el usuario tenga `company_memberships.is_active = true`.

## Implementación Técnica

### Archivos Modificados
- `app/(protected)/sales/page.tsx` - Nueva página de ventas
- `app/(protected)/components/app-shell.tsx` - Navegación actualizada
- Migración `20260313_000024_reader_role_sales_view_permissions.sql` - Políticas RLS

### Políticas de Base de Datos
```sql
-- tickets_select incluye READER (puede ver)
-- tickets_insert excluye READER (no puede crear)  
-- tickets_update excluye READER (no puede modificar)
-- tickets_delete excluye READER (no puede eliminar)
```

## Próximos Pasos

1. **Crear usuarios de ventas** y asignarles el rol `READER`
2. **Capacitar al equipo** sobre cómo usar la vista de solo lectura
3. **Monitorear el uso** para asegurar que cumple con las necesidades
4. **Considerar extensiones** como reportes personalizados para ventas

---

**Nota**: Esta implementación está diseñada para ser segura por defecto. Los usuarios con rol `READER` tendrán exactamente las capacidades de visualización que necesitan sin riesgo de modificaciones accidentales.
