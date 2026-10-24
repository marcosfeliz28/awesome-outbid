//! Envío RAW ESC/POS al spooler de Windows. Solo se admite una impresora que
//! Windows ya enumera; el HTML y los datos del negocio nunca son comandos RAW.
use std::{ffi::c_void, ptr};

type PrinterHandle = *mut c_void;
const PRINTER_ENUM_LOCAL: u32 = 0x2;
const PRINTER_ENUM_CONNECTIONS: u32 = 0x4;

#[repr(C)]
#[derive(Clone, Copy)]
struct PrinterInfo4 {
    name: *const u16,
    server: *const u16,
    attributes: u32,
}

#[repr(C)]
struct DocInfo1 {
    name: *const u16,
    output: *const u16,
    datatype: *const u16,
}

#[link(name = "Winspool")]
extern "system" {
    fn EnumPrintersW(
        flags: u32,
        name: *mut u16,
        level: u32,
        buffer: *mut u8,
        size: u32,
        needed: *mut u32,
        count: *mut u32,
    ) -> i32;
    fn OpenPrinterW(name: *mut u16, handle: *mut PrinterHandle, defaults: *mut c_void) -> i32;
    fn StartDocPrinterW(handle: PrinterHandle, level: u32, info: *const DocInfo1) -> u32;
    fn StartPagePrinter(handle: PrinterHandle) -> i32;
    fn WritePrinter(
        handle: PrinterHandle,
        buffer: *const c_void,
        size: u32,
        written: *mut u32,
    ) -> i32;
    fn EndPagePrinter(handle: PrinterHandle) -> i32;
    fn EndDocPrinter(handle: PrinterHandle) -> i32;
    fn ClosePrinter(handle: PrinterHandle) -> i32;
}

fn wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}

unsafe fn wide_string(value: *const u16) -> String {
    if value.is_null() {
        return String::new();
    }
    let mut len = 0;
    while len < 1024 && *value.add(len) != 0 {
        len += 1;
    }
    String::from_utf16_lossy(std::slice::from_raw_parts(value, len))
}

pub fn list_printers() -> Result<Vec<String>, String> {
    let mut needed = 0;
    let mut count = 0;
    unsafe {
        EnumPrintersW(
            PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS,
            ptr::null_mut(),
            4,
            ptr::null_mut(),
            0,
            &mut needed,
            &mut count,
        );
        if needed == 0 {
            return Ok(Vec::new());
        }
        if needed > 1024 * 1024 {
            return Err("Windows devolvió una lista de impresoras demasiado grande.".into());
        }
        let mut buffer = vec![0u8; needed as usize];
        if EnumPrintersW(
            PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS,
            ptr::null_mut(),
            4,
            buffer.as_mut_ptr(),
            needed,
            &mut needed,
            &mut count,
        ) == 0
        {
            return Err("Windows no pudo enumerar las impresoras.".into());
        }
        let stride = std::mem::size_of::<PrinterInfo4>();
        if count as usize > buffer.len() / stride {
            return Err("Respuesta de impresoras inválida.".into());
        }
        let mut names = Vec::new();
        for index in 0..count as usize {
            let info =
                ptr::read_unaligned(buffer.as_ptr().add(index * stride) as *const PrinterInfo4);
            let name = wide_string(info.name);
            if !name.is_empty() {
                names.push(name);
            }
        }
        names.sort();
        names.dedup();
        Ok(names)
    }
}

fn escpos_text(text: &str, columns: u8) -> Result<Vec<u8>, String> {
    if ![32, 48].contains(&columns) || text.is_empty() || text.len() > 65536 {
        return Err("Ticket vacío, demasiado grande o ancho inválido.".into());
    }
    let mut body = Vec::with_capacity(text.len() + 40);
    body.extend_from_slice(&[0x1b, b'@', 0x1b, b't', 19]); // iniciar; CP858
    for line in text.lines() {
        let mut position = 0;
        for c in line.chars() {
            let byte = match c {
                '\t' => b' ',
                ' '..='~' => c as u8,
                'á' => 160,
                'é' => 130,
                'í' => 161,
                'ó' => 162,
                'ú' => 163,
                'ñ' => 164,
                'Ñ' => 165,
                'ü' => 129,
                'Ü' => 154,
                'Á' => 181,
                'É' => 144,
                'Í' => 214,
                'Ó' => 224,
                'Ú' => 233,
                '¡' => 173,
                '¿' => 168,
                '°' => 248,
                '€' => 213,
                _ => b'?',
            };
            body.push(byte);
            position += 1;
            if position >= columns {
                body.push(b'\n');
                position = 0;
            }
        }
        if position != 0 {
            body.push(b'\n');
        }
    }
    body.extend_from_slice(b"\n\n\n");
    body.extend_from_slice(&[0x1d, b'V', 0]); // corte completo
    Ok(body)
}

fn send(printer_name: &str, bytes: &[u8]) -> Result<(), String> {
    if printer_name.is_empty()
        || printer_name.len() > 200
        || !list_printers()?.iter().any(|name| name == printer_name)
    {
        return Err("Elige una impresora instalada en Windows.".into());
    }
    let mut handle: PrinterHandle = ptr::null_mut();
    let mut name = wide(printer_name);
    unsafe {
        if OpenPrinterW(name.as_mut_ptr(), &mut handle, ptr::null_mut()) == 0 {
            return Err("No se pudo abrir la impresora seleccionada.".into());
        }
        let title = wide("Nexora POS");
        let raw = wide("RAW");
        let doc = DocInfo1 {
            name: title.as_ptr(),
            output: ptr::null(),
            datatype: raw.as_ptr(),
        };
        let mut result = Err("No se pudo enviar el ticket a la impresora.".to_string());
        if StartDocPrinterW(handle, 1, &doc) != 0 {
            if StartPagePrinter(handle) != 0 {
                let mut written = 0;
                if WritePrinter(
                    handle,
                    bytes.as_ptr() as *const c_void,
                    bytes.len() as u32,
                    &mut written,
                ) != 0
                    && written == bytes.len() as u32
                {
                    result = Ok(());
                }
                EndPagePrinter(handle);
            }
            EndDocPrinter(handle);
        }
        ClosePrinter(handle);
        result
    }
}

pub fn print(printer_name: &str, text: &str, columns: u8, open_drawer: bool) -> Result<(), String> {
    let mut bytes = escpos_text(text, columns)?;
    if open_drawer {
        bytes.splice(5..5, [0x1b, b'p', 0, 25, 250]);
    }
    send(printer_name, &bytes)
}

pub fn open_drawer(printer_name: &str) -> Result<(), String> {
    send(printer_name, &[0x1b, b'p', 0, 25, 250])
}

#[cfg(test)]
mod tests {
    use super::escpos_text;

    #[test]
    fn customer_text_cannot_inject_drawer_or_cut_commands() {
        let bytes = escpos_text("Cliente A\u{1b}p\u{1d}V", 48).unwrap();
        assert!(bytes
            .windows(b"Cliente A?p?V".len())
            .any(|part| part == b"Cliente A?p?V"));
        assert!(!bytes.windows(3).any(|part| part == [0x1b, b'p', 0]));
    }

    #[test]
    fn rejects_invalid_width_and_oversized_ticket() {
        assert!(escpos_text("hola", 80).is_err());
        assert!(escpos_text(&"a".repeat(65537), 48).is_err());
    }
}
