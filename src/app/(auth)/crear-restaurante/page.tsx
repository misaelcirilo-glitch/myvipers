import { redirect } from 'next/navigation';

// El alta directa se cerró (creaba negocios sin revisión). Los enlaces antiguos llevan a la
// solicitud, que el equipo aprueba desde /plataforma/solicitudes.
export default function CrearRestaurantePage() {
    redirect('/registrar-negocio');
}
