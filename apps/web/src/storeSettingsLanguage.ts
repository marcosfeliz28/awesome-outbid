export const STORE_SETTINGS_EN: Readonly<Record<string, string>> = {
  "El logo debe pesar como máximo 200 KB.": "The logo must be no larger than 200 KB.",
  "Logo guardado.": "Logo saved.",
  "Logo del negocio": "Business logo",
  "Sin logo": "No logo",
  "Subir logo (hasta 200 KB)": "Upload logo (up to 200 KB)",
  "Cajas (número y nombre en el cuadre)": "Registers (number and name on the cash reconciliation)",
  "Equipo: ": "Device: ",
  "Editar caja": "Edit register",
  "Cajeros (número en el cuadre y los reportes)": "Cashiers (number on the cash reconciliation and reports)",
  "No. de cajero": "Cashier no.",
  "Caja · ": "Register · ",
  "Número de caja (ej. 4012)": "Register number (e.g. 4012)",
  "Nombre de caja": "Register name",
  "Cajero · ": "Cashier · ",
  "Número de cajero (ej. 1031)": "Cashier number (e.g. 1031)"
};
export const storeSettingsText = (english: boolean, text: string) => english ? STORE_SETTINGS_EN[text] ?? text : text;
