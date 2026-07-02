import LegalPage from '@/components/legal/LegalPage';

export const metadata = { title: 'Términos y Condiciones — Formula Taller' };

// Texto base: revísalo/ajústalo (o hazlo revisar por un abogado) según tu negocio.
export default function TerminosPage() {
  return (
    <LegalPage title="Términos y Condiciones" updated="2026-07-02">
      <p>
        Al registrar un taller y usar Formula Taller (la &quot;Plataforma&quot;) aceptas estos
        Términos. Si no estás de acuerdo, no uses el servicio.
      </p>

      <h2>1. El servicio</h2>
      <p>
        Formula Taller es una aplicación web para gestionar órdenes de servicio de talleres
        mecánicos y compartir el seguimiento con los clientes. El servicio se ofrece
        &quot;tal cual&quot;, pudiendo cambiar o mejorar sus funciones con el tiempo.
      </p>

      <h2>2. Cuenta del taller</h2>
      <p>
        Eres responsable de la veracidad de los datos de registro, de la seguridad de tu
        contraseña y de la actividad de los usuarios (mecánicos) que crees dentro de tu taller.
      </p>

      <h2>3. Planes y pagos</h2>
      <p>
        El plan gratuito permite un número limitado de órdenes. Para superar ese límite deberás
        contratar la suscripción correspondiente. Las condiciones y precios podrán actualizarse
        avisando con antelación razonable.
      </p>

      <h2>4. Uso correcto</h2>
      <p>
        Te comprometes a no usar la Plataforma para fines ilícitos, a no subir contenido que
        infrinja derechos de terceros y a no intentar vulnerar su seguridad.
      </p>

      <h2>5. Datos de tus clientes</h2>
      <p>
        Al cargar datos de tus clientes (nombre, WhatsApp, vehículo, fotos, etc.) declaras contar
        con su consentimiento. El taller es responsable de esos datos; Formula Taller actúa como
        proveedor tecnológico que los procesa para prestar el servicio.
      </p>

      <h2>6. Disponibilidad y responsabilidad</h2>
      <p>
        Hacemos esfuerzos razonables para mantener el servicio disponible, pero no garantizamos
        que sea ininterrumpido o libre de errores. En la medida permitida por la ley, no somos
        responsables por pérdidas indirectas derivadas del uso del servicio.
      </p>

      <h2>7. Cancelación</h2>
      <p>
        Puedes eliminar la cuenta de tu taller en cualquier momento desde el Perfil del Taller.
        Esto borra de forma permanente tus datos, usuarios, órdenes y adjuntos.
      </p>

      <h2>8. Contacto</h2>
      <p>Para dudas sobre estos Términos, escríbenos a somosformulataller@gmail.com.</p>
    </LegalPage>
  );
}
