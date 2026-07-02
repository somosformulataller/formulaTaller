import LegalPage from '@/components/legal/LegalPage';

export const metadata = { title: 'Política de Privacidad — Formula Taller' };

// Texto base: revísalo/ajústalo (o hazlo revisar por un abogado) según tu negocio.
export default function PrivacidadPage() {
  return (
    <LegalPage title="Política de Privacidad" updated="2026-07-02">
      <p>
        Esta política explica qué datos tratamos en Formula Taller, con qué fin y cómo puedes
        ejercer tus derechos.
      </p>

      <h2>1. Datos que tratamos</h2>
      <p>
        <strong>De los usuarios del taller:</strong> nombre, correo electrónico, teléfono/WhatsApp
        y contraseña (almacenada cifrada). <strong>De los clientes del taller:</strong> nombre,
        WhatsApp, datos del vehículo, y las fotos/videos/notas de voz/documentos que el taller
        adjunte a cada orden.
      </p>

      <h2>2. Para qué los usamos</h2>
      <p>
        Para prestar el servicio: gestionar órdenes, mostrar el seguimiento al cliente mediante un
        enlace, y permitir el envío de mensajes por WhatsApp desde el dispositivo del taller.
      </p>

      <h2>3. Con quién se comparten</h2>
      <p>
        No vendemos tus datos. Se procesan en proveedores de infraestructura (Vercel y Supabase)
        necesarios para operar la Plataforma. Los mensajes de WhatsApp se envían desde el propio
        dispositivo del taller usando la app de WhatsApp del usuario.
      </p>

      <h2>4. Enlace de seguimiento del cliente</h2>
      <p>
        El seguimiento se comparte mediante un enlace con un identificador aleatorio. Quien tenga
        el enlace puede ver el estado y los adjuntos de esa orden. Comparte el enlace solo con el
        cliente correspondiente.
      </p>

      <h2>5. Conservación y eliminación</h2>
      <p>
        Los datos se conservan mientras la cuenta esté activa. Al eliminar la cuenta del taller, sus
        datos, usuarios, órdenes y adjuntos se borran de forma permanente.
      </p>

      <h2>6. Cookies</h2>
      <p>
        Usamos cookies estrictamente necesarias para mantener la sesión iniciada. No usamos cookies
        de publicidad.
      </p>

      <h2>7. Seguridad</h2>
      <p>
        Aplicamos medidas razonables para proteger la información (control de acceso por taller,
        cifrado de contraseñas, conexiones seguras). Ningún sistema es 100% infalible.
      </p>

      <h2>8. Tus derechos y contacto</h2>
      <p>
        Puedes solicitar acceso, corrección o eliminación de tus datos escribiendo a
        somosformulataller@gmail.com.
      </p>
    </LegalPage>
  );
}
