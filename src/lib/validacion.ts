/**
 * Mensajes de validación de formularios EN ESPAÑOL.
 *
 * Los avisos que salen al enviar un formulario ("Please fill out this field",
 * "Please include an '@'…") los escribe el navegador, no la app, y los escribe
 * en el idioma del NAVEGADOR. Un taller con el teléfono en inglés veía la app
 * entera en español y los avisos en inglés.
 *
 * La única forma de mandar sobre eso es decirle al navegador el texto exacto
 * con `setCustomValidity`. Eso se hace aquí, en un solo sitio, para que todos
 * los campos hablen igual.
 *
 * Importante: el mensaje personalizado se queda pegado al campo hasta que se
 * borra. Si no se limpiara al escribir, el campo seguiría considerándose
 * inválido aunque el usuario ya lo hubiera corregido y el formulario no se
 * podría enviar nunca. Por eso van siempre las dos mitades: `onInvalid`
 * (poner el texto) y `onInput` (quitarlo).
 */

type CampoValidable = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/** El texto que corresponde a lo que el navegador encontró mal. */
export function mensajeDeValidacion(campo: CampoValidable): string {
  const v = campo.validity;
  const tipo = (campo as HTMLInputElement).type;

  if (v.valueMissing) {
    if (tipo === 'email') return 'Escribe el correo.';
    if (tipo === 'password') return 'Escribe la contraseña.';
    if (tipo === 'tel') return 'Escribe el teléfono.';
    if (tipo === 'checkbox' || tipo === 'radio') return 'Marca esta casilla para continuar.';
    if (campo.tagName === 'SELECT') return 'Elige una opción.';
    return 'Completa este campo.';
  }

  if (v.typeMismatch) {
    if (tipo === 'email') return 'Escribe un correo válido, como nombre@correo.com.';
    if (tipo === 'url') return 'Escribe una dirección web válida.';
    return 'El dato no tiene el formato correcto.';
  }

  if (v.tooShort) {
    const min = (campo as HTMLInputElement).minLength;
    return `Debe tener al menos ${min} caracteres.`;
  }

  if (v.tooLong) {
    const max = (campo as HTMLInputElement).maxLength;
    return `No puede pasar de ${max} caracteres.`;
  }

  if (v.rangeUnderflow) {
    return `El valor mínimo es ${(campo as HTMLInputElement).min}.`;
  }

  if (v.rangeOverflow) {
    return `El valor máximo es ${(campo as HTMLInputElement).max}.`;
  }

  if (v.stepMismatch) return 'Ese valor no es válido para este campo.';
  if (v.patternMismatch) return 'El formato no es válido.';

  // Cualquier caso que no se contemple: mejor una frase clara en español que
  // el texto del navegador en otro idioma.
  return 'Revisa este campo.';
}

/** Pone el mensaje en español cuando el navegador marca el campo como inválido. */
export function alSerInvalido(e: { currentTarget: CampoValidable }): void {
  const campo = e.currentTarget;
  campo.setCustomValidity('');
  if (!campo.checkValidity()) {
    campo.setCustomValidity(mensajeDeValidacion(campo));
  }
}

/** Limpia el mensaje al escribir, para que el campo pueda volver a ser válido. */
export function alEscribir(e: { currentTarget: CampoValidable }): void {
  e.currentTarget.setCustomValidity('');
}
