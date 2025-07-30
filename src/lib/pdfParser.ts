import { ParsedPDFData, ParsedPDFOrder, ParsedInvoiceData, InvoiceLine } from './types';

// Estrazione del testo PDF tramite funzione dedicata
export async function parsePDFText(file: File): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('Parsing PDF diretto:', file.name);
      
      const result = await extractPDFTextDirect(file);
      
      if (!result.text || result.text.trim().length === 0) {
        throw new Error('Nessun testo estratto dal PDF');
      }
      
      console.log(`PDF parsing success: ${result.length} caratteri, ${result.pages} pagine`);
      resolve(result.text);
      
    } catch (error) {
      console.error('Error in direct PDF parsing:', error);
      reject(new Error(error instanceof Error ? error.message : 'Errore parsing PDF'));
    }
  });
}

// Estrazione diretta del testo PDF (stesso codice dell'API ma come funzione)
async function extractPDFTextDirect(file: File): Promise<{text: string, pages: number, length: number}> {
  // Setup globali per pdfjs-dist in Node.js
  if (typeof global !== 'undefined') {
    // Promise.withResolvers polyfill (per Node.js vecchie)
    if (!(Promise as any).withResolvers) {
      (Promise as any).withResolvers = function() {
        let resolve: (value: any) => void;
        let reject: (reason?: any) => void;
        const promise = new Promise((res, rej) => {
          resolve = res;
          reject = rej;
        });
        return { promise, resolve: resolve!, reject: reject! };
      };
    }
    
    // DOMMatrix polyfill
    if (!(global as any).DOMMatrix) {
      (global as any).DOMMatrix = class DOMMatrix {
        public a = 1; public b = 0; public c = 0; public d = 1; public e = 0; public f = 0;
        constructor() {}
      };
    }
    
    // Window polyfill completo
    if (!(global as any).window) {
      (global as any).window = {
        location: { 
          protocol: 'https:', 
          hostname: 'localhost',
          href: 'https://localhost/'
        },
        document: { 
          createElement: () => ({ getContext: () => null }),
          documentElement: { style: {} }
        },
        btoa: (str: string) => Buffer.from(str).toString('base64'),
        atob: (str: string) => Buffer.from(str, 'base64').toString(),
        navigator: { userAgent: 'Node.js' }
      };
    }
    
    // Document polyfill
    if (!(global as any).document) {
      (global as any).document = (global as any).window.document;
    }
    
    // Navigator polyfill
    if (!(global as any).navigator) {
      (global as any).navigator = (global as any).window.navigator;
    }
  }

  console.log('Parsing PDF file:', file.name, 'Size:', file.size);

  // Import dinamico
  const pdfjsLib = await import('pdfjs-dist');
  
  // Configurazione worker per Node.js - disabilita completamente
  delete (pdfjsLib.GlobalWorkerOptions as any).workerSrc;
  (pdfjsLib.GlobalWorkerOptions as any).workerSrc = '';

  const arrayBuffer = await file.arrayBuffer();
  
  // Configurazione robusta per Node.js
  const pdf = await pdfjsLib.getDocument({
    data: arrayBuffer,
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: true,
    disableAutoFetch: true,
    disableStream: true,
    useWorkerFetch: false,
    disableRange: true
  }).promise;

  let extractedText = '';

  // Estrai il testo da tutte le pagine
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    try {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      const pageText = textContent.items
        .map((item: any) => {
          if (item && typeof item === 'object' && 'str' in item) {
            return item.str || '';
          }
          return '';
        })
        .join(' ');

      extractedText += pageText + '\n';
    } catch (pageError) {
      console.warn(`Errore pagina ${pageNum}:`, pageError);
      // Continua con le altre pagine
    }
  }

  if (extractedText.trim().length === 0) {
    throw new Error('No text extracted from PDF');
  }

  console.log(`PDF text extracted successfully: ${extractedText.length} characters`);

  return {
    text: extractedText,
    pages: pdf.numPages,
    length: extractedText.length
  };
}

export function parseGestionaleData(pdfText: string): ParsedPDFData | null {
  try {
    console.log('Inizio parsing del testo PDF...'); // Debug
    
    // Parsing delle informazioni del vettore
    const vettoreMatch = pdfText.match(/Vettore:([^]*?)(?=Autista|$)/i);
    let vettore = '';
    let partitaIva = '';
    
    if (vettoreMatch) {
      const vettoreSection = vettoreMatch[1];
      const partitaIvaMatch = vettoreSection.match(/(\d{10,11})/);
      partitaIva = partitaIvaMatch ? partitaIvaMatch[1] : '';
      
      // Estrae il nome del vettore
      const vettoreNameMatch = vettoreSection.match(/(\d+)\s*-\s*([^,]+)/);
      vettore = vettoreNameMatch ? vettoreNameMatch[2].trim() : '';
    }
    
    // Parsing delle informazioni di carico
    const dataCaricMatch = pdfText.match(/Data di carico:\s*([^\s]+)/i);
    const dataCarico = dataCaricMatch ? dataCaricMatch[1] : '';
    
    const baseCaricMatch = pdfText.match(/Base di carico:\s*([^D]+?)(?=Data|$)/i);
    const luogoCarico = baseCaricMatch ? baseCaricMatch[1].trim() : '';
    
    const statoMatch = pdfText.match(/Stato:\s*([^\n]+)/i);
    const stato = statoMatch ? statoMatch[1].trim() : '';
    
    // Parsing delle informazioni autista
    const autistaMatch = pdfText.match(/Autista:\s*([^(]+)/i);
    const autista = autistaMatch ? autistaMatch[1].trim() : '';
    
    const codiceAutistaMatch = pdfText.match(/Autista:[^(]*\(([^)]+)\)/i);
    const codiceAutista = codiceAutistaMatch ? codiceAutistaMatch[1] : '';
    
    const targaMotriceMatch = pdfText.match(/Targa motrice:\s*([^\s(]+)/i);
    const targaMotrice = targaMotriceMatch ? targaMotriceMatch[1] : '';
    
    const targaRimorchioMatch = pdfText.match(/Targa rimorchio:\s*([^\s]+)/i);
    const targaRimorchio = targaRimorchioMatch ? targaRimorchioMatch[1] : '';
    
    const tankContainerMatch = pdfText.match(/Tank container:\s*([^\s]+)/i);
    const tankContainer = tankContainerMatch ? tankContainerMatch[1] : '';
    
    // Parsing numero BDC
    const bdcMatch = pdfText.match(/Numero BDC:\s*([^\s\n]+)/i);
    const bdcNumber = bdcMatch ? bdcMatch[1] : '';
    
    console.log('Info vettore:', { vettore, partitaIva }); // Debug
    console.log('Info autista:', autista); // Debug
    console.log('BDC:', bdcNumber); // Debug
    
    // Parsing degli ordini con nuova logica
    const orders = parseOrdersImproved(pdfText);
    console.log('Ordini trovati:', orders.length); // Debug
    
    return {
      carrierInfo: {
        vettore,
        partitaIva,
        address: luogoCarico
      },
      loadingInfo: {
        dataCarico,
        luogoCarico,
        stato
      },
      driverInfo: {
        autista,
        codiceAutista,
        targaMotrice,
        targaRimorchio,
        tankContainer
      },
      bdcNumber,
      orders
    };
  } catch (error) {
    console.error('Error parsing PDF:', error);
    return null;
  }
}

function parseOrdersImproved(pdfText: string): ParsedPDFOrder[] {
  const orders: ParsedPDFOrder[] = [];
  
  console.log('Testo completo per parsing ordini:', pdfText.substring(0, 500) + '...'); // Debug
  
  // Dividiamo il testo usando "Ordine:" come separatore
  const orderSections = pdfText.split(/(?=Ordine:\s*[\d-]+)/i);
  
  console.log('Sezioni trovate:', orderSections.length); // Debug
  
  for (let i = 0; i < orderSections.length; i++) {
    const section = orderSections[i].trim();
    
    // Salta sezioni vuote o che non contengono "Ordine:"
    if (!section || !section.match(/Ordine:\s*[\d-]+/i)) {
      console.log('Sezione saltata:', i, section.substring(0, 100)); // Debug
      continue;
    }
    
    console.log('Elaborando sezione:', i, section.substring(0, 100) + '...'); // Debug
    
    // Estrae il numero dell'ordine
    const orderMatch = section.match(/Ordine:\s*([\d-]+)/i);
    const orderNumber = orderMatch ? orderMatch[1] : '';
    
    console.log('Numero ordine trovato:', orderNumber); // Debug
    
    if (orderNumber) {
      // Parsa i dati dell'ordine
      const order = parseOrderFromText(orderNumber, section);
      if (order) {
        orders.push(order);
        console.log('Ordine aggiunto:', order.orderNumber, 'Totale finora:', orders.length); // Debug
      }
    }
  }
  
  console.log('Totale ordini trovati:', orders.length); // Debug
  return orders;
}

function parseOrderFromText(orderNumber: string, orderText: string): ParsedPDFOrder | null {
  try {
    // Estrai prodotto
    const productMatch = orderText.match(/Prodotto:\s*([^]*?)(?=Cliente:|$)/i);
    const product = productMatch ? productMatch[1].trim().replace(/\s+/g, ' ') : '';
    
    // Estrai informazioni cliente
    const clienteMatch = orderText.match(/Cliente:\s*([^]*?)(?=Destinazione:|$)/i);
    let customerName = '';
    let customerCode = '';
    
    if (clienteMatch) {
      const clienteText = clienteMatch[1];
      // Cerca il codice cliente
      const codeMatch = clienteText.match(/cod=\(([^)]+)\)/i);
      customerCode = codeMatch ? codeMatch[1].trim() : '';
      
      // Estrae il nome cliente
      const namePart = clienteText.split('cod=')[0];
      const nameParts = namePart.split('-');
      if (nameParts.length > 1) {
        customerName = nameParts.slice(1).join('-').trim();
      } else {
        customerName = namePart.trim();
      }
      // Pulisce da virgole e indirizzi extra
      customerName = customerName.split(',')[0].trim();
    }
    
    // Estrai informazioni destinazione
    const destinazioneMatch = orderText.match(/Destinazione:\s*([^]*?)(?=Quantità:|$)/i);
    let deliveryAddress = '';
    let destinationCode = '';
    
    if (destinazioneMatch) {
      const destText = destinazioneMatch[1];
      // Cerca il codice destinazione
      const codeMatch = destText.match(/cod=\(([^)]+)\)/i);
      destinationCode = codeMatch ? codeMatch[1].trim() : '';
      
      // Estrae l'indirizzo
      const addressPart = destText.split('cod=')[0];
      const addressParts = addressPart.split('-');
      if (addressParts.length > 1) {
        deliveryAddress = addressParts.slice(1).join('-').trim();
      } else {
        deliveryAddress = addressPart.trim();
      }
      // Pulisce da virgole e indirizzi extra
      deliveryAddress = deliveryAddress.split(',')[0].trim();
    }
    
    // Estrai quantità
    const quantitaMatch = orderText.match(/Quantità:\s*(\d+(?:[.,]\d+)?)\s*([^\s\n]+)/i);
    let quantity = 0;
    let quantityUnit = 'L';
    
    if (quantitaMatch) {
      quantity = parseFloat(quantitaMatch[1].replace(',', '.'));
      quantityUnit = quantitaMatch[2].replace(/[()]/g, '').trim();
    }
    
    // Estrai identificativo
    const identificativoMatch = orderText.match(/Identificativo:\s*([^\s\n]+)/i);
    const identifier = identificativoMatch ? identificativoMatch[1].trim() : '';
    
    // Verifica se l'ordine ha dati essenziali
    if (!orderNumber || !product) {
      console.log('Ordine scartato per dati mancanti:', { orderNumber, product }); // Debug
      return null;
    }
    
    const parsedOrder: ParsedPDFOrder = {
      orderNumber: orderNumber.trim(),
      product: product,
      customerName: customerName || 'Da completare',
      customerCode: customerCode,
      deliveryAddress: deliveryAddress || 'Da completare',
      destinationCode: destinationCode,
      quantity: quantity,
      quantityUnit: quantityUnit,
      identifier: identifier
    };
    
    console.log('Ordine parsato:', parsedOrder); // Debug
    return parsedOrder;
    
  } catch (error) {
    console.error('Errore nel parsing dell\'ordine:', error);
    return null;
  }
}



// Funzione di fallback per parsing manuale (mantenuta per retrocompatibilità) 
export function parseGestionaleDataManual(pdfText: string): ParsedPDFData | null {
  return parseGestionaleData(pdfText);
} 

export async function parseImageWithAI(file: File): Promise<ParsedPDFData | null> {
  const formData = new FormData();
  formData.append('image', file);

  try {
    const response = await fetch('/api/parse-image', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error from API:', errorText);
      alert(`Error from API: ${errorText}`);
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();
    if (data.error) {
      console.error('Error from API:', data.details);
      alert(`Error from API: ${data.details}`);
      return null;
    }
    return data as ParsedPDFData;
  } catch (error) {
    console.error('Error parsing image with AI:', error);
    alert('Failed to parse image with AI. Check the console for more details.');
    return null;
  }
}

// Invoice PDF parsing functions - Italian Electronic Invoice
export function parseInvoiceData(pdfText: string): ParsedInvoiceData | null {
  try {
    console.log('Inizio parsing della fattura elettronica italiana...', pdfText.substring(0, 500));
    
    // Prova prima il parsing della fattura elettronica italiana
    const italianInvoiceData = parseItalianElectronicInvoice(pdfText);
    if (italianInvoiceData) {
      return italianInvoiceData;
    }
    
    // Fallback al parsing generico
    return parseGenericInvoice(pdfText);
    
  } catch (error) {
    console.error('Error parsing invoice PDF:', error);
    return null;
  }
}

// Parsing specifico per fatture elettroniche italiane
function parseItalianElectronicInvoice(pdfText: string): ParsedInvoiceData | null {
  try {
    console.log('Parsing fattura elettronica italiana...');
    
    // Parsing numero fattura (es. 1543/A8)
    const invoiceNumberMatch = pdfText.match(/(?:Numero documento|Numero)\s*(\d+\/[A-Z0-9]+|\d+)/i);
    const invoiceNumber = invoiceNumberMatch ? invoiceNumberMatch[1] : '';
    
    // Parsing data documento (es. 02-08-2024)
    const dateMatch = pdfText.match(/(?:Data documento|Data)\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/i);
    const date = dateMatch ? dateMatch[1] : '';
    
    // Parsing Cedente/prestatore (fornitore)
    const issuerInfo = parseItalianIssuer(pdfText);
    
    // Parsing Cessionario/committente (cliente)
    const clientInfo = parseItalianClient(pdfText);
    
    // Parsing importi
    const amounts = parseItalianAmounts(pdfText);
    
    // Parsing causale
    const causaleMatch = pdfText.match(/Causale\s*([^\n\r]+)/i);
    const description = causaleMatch ? causaleMatch[1].trim() : '';
    
    // Parsing scadenza pagamento
    const dueDateMatch = pdfText.match(/(?:Data scadenza|Scadenza)\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/i);
    const dueDate = dueDateMatch ? dueDateMatch[1] : '';
    
    // Parsing modalità pagamento
    const paymentModeMatch = pdfText.match(/(?:Modalità pagamento|MP\d+)\s*([^\n\r]+)/i);
    const paymentTerms = paymentModeMatch ? paymentModeMatch[1].trim() : '';
    
    // Parsing dettagli trasporto specifici
    const transportDetails = parseTransportDetails(pdfText);
    
    // Parsing linee di dettaglio per fatture complesse
    const invoiceLines = parsePDFInvoiceLines(pdfText);
    
    console.log('Dati fattura elettronica estratti:', {
      invoiceNumber,
      date,
      issuerInfo,
      clientInfo,
      amounts,
      transportDetails,
      invoiceLines
    });
    
    return {
      invoiceNumber,
      date,
      issuerInfo,
      clientInfo,
      amounts,
      description,
      paymentTerms,
      dueDate,
      transportDetails,
      invoiceLines
    };
    
  } catch (error) {
    console.error('Error parsing Italian electronic invoice:', error);
    return null;
  }
}

// Parsing generico per fatture non elettroniche italiane
function parseGenericInvoice(pdfText: string): ParsedInvoiceData | null {
  // Parsing numero fattura
  const invoiceNumberMatch = pdfText.match(/(?:fattura|invoice|n[\.\s]*|numero[\.\s]*)\s*(\d+(?:\/\d+)?)/i);
  const invoiceNumber = invoiceNumberMatch ? invoiceNumberMatch[1] : '';
  
  // Parsing data fattura
  const dateMatch = pdfText.match(/(?:data|date)[\s\:]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
  const date = dateMatch ? dateMatch[1] : '';
  
  // Parsing informazioni emittente
  const issuerInfo = parseIssuerInfo(pdfText);
  
  // Parsing informazioni cliente
  const clientInfo = parseClientInfo(pdfText);
  
  // Parsing importi
  const amounts = parseAmounts(pdfText);
  
  // Parsing descrizione
  const descriptionMatch = pdfText.match(/(?:descrizione|description)[\s\:]*([^\n\r]{1,200})/i);
  const description = descriptionMatch ? descriptionMatch[1].trim() : '';
  
  // Parsing termini di pagamento
  const paymentTermsMatch = pdfText.match(/(?:pagamento|payment|scadenza)[\s\:]*([^\n\r]{1,100})/i);
  const paymentTerms = paymentTermsMatch ? paymentTermsMatch[1].trim() : '';
  
  // Parsing data scadenza
  const dueDateMatch = pdfText.match(/(?:scadenza|due date|scade)[\s\:]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
  const dueDate = dueDateMatch ? dueDateMatch[1] : '';
  
  return {
    invoiceNumber,
    date,
    issuerInfo,
    clientInfo,
    amounts,
    description,
    paymentTerms,
    dueDate
  };
}

// Parsing specifico per cedente/prestatore italiano
function parseItalianIssuer(pdfText: string): { name: string; taxCode: string; address: string } {
  // Cerca denominazione del cedente
  const issuerNameMatch = pdfText.match(/Cedente\/prestatore[\s\S]*?Denominazione:\s*([^\n\r]+)/i);
  const name = issuerNameMatch ? issuerNameMatch[1].trim() : '';
  
  // Cerca codice fiscale del cedente (formato IT + 11 cifre)
  const issuerTaxMatch = pdfText.match(/Cedente\/prestatore[\s\S]*?(?:Identificativo fiscale ai fini IVA|Codice fiscale):\s*(IT\d{11}|\d{11})/i);
  const taxCode = issuerTaxMatch ? issuerTaxMatch[1] : '';
  
  // Cerca indirizzo del cedente
  const addressMatch = pdfText.match(/Cedente\/prestatore[\s\S]*?Indirizzo:\s*([^\n\r]+)/i);
  let address = addressMatch ? addressMatch[1].trim() : '';
  
  // Aggiungi comune e provincia se disponibili
  const cityMatch = pdfText.match(/Cedente\/prestatore[\s\S]*?Comune:\s*([^\s]+)\s*Provincia:\s*([^\s]+)/i);
  if (cityMatch) {
    address += `, ${cityMatch[1]} (${cityMatch[2]})`;
  }
  
  return { name, taxCode, address };
}

// Parsing specifico per cessionario/committente italiano
function parseItalianClient(pdfText: string): { name: string; taxCode: string; address: string } {
  // Cerca denominazione del cessionario
  const clientNameMatch = pdfText.match(/Cessionario\/committente[\s\S]*?Denominazione:\s*([^\n\r]+)/i);
  const name = clientNameMatch ? clientNameMatch[1].trim() : '';
  
  // Cerca codice fiscale del cessionario
  const clientTaxMatch = pdfText.match(/Cessionario\/committente[\s\S]*?(?:Identificativo fiscale ai fini IVA|Codice fiscale):\s*(IT\d{11}|\d{11})/i);
  const taxCode = clientTaxMatch ? clientTaxMatch[1] : '';
  
  // Cerca indirizzo del cessionario
  const addressMatch = pdfText.match(/Cessionario\/committente[\s\S]*?Indirizzo:\s*([^\n\r]+)/i);
  let address = addressMatch ? addressMatch[1].trim() : '';
  
  // Aggiungi comune e provincia se disponibili
  const cityMatch = pdfText.match(/Cessionario\/committente[\s\S]*?Comune:\s*([^\s]+)\s*Provincia:\s*([^\s]+)/i);
  if (cityMatch) {
    address += `, ${cityMatch[1]} (${cityMatch[2]})`;
  }
  
  return { name, taxCode, address };
}

// Parsing specifico per importi italiani
function parseItalianAmounts(pdfText: string): { netAmount: number; taxAmount: number; totalAmount: number } {
  // Cerca totale documento
  const totalMatch = pdfText.match(/(?:Totale documento|ImportoTotaleDocumento)[:\s]*(\d+[.,]\d{2})/i);
  const totalAmount = totalMatch ? parseFloat(totalMatch[1].replace(',', '.')) : 0;
  
  // Cerca totale imposta
  const taxMatch = pdfText.match(/(?:Totale imposta|Imposta)[:\s]*(\d+[.,]\d{2})/i);
  const taxAmount = taxMatch ? parseFloat(taxMatch[1].replace(',', '.')) : 0;
  
  // Cerca totale imponibile
  const netMatch = pdfText.match(/(?:Totale imponibile|ImponibileImporto)[:\s]*(\d+[.,]\d{2})/i);
  const netAmount = netMatch ? parseFloat(netMatch[1].replace(',', '.')) : (totalAmount - taxAmount);
  
  return { netAmount, taxAmount, totalAmount };
}

// Parsing dettagli trasporto per fatture elettroniche
function parseTransportDetails(pdfText: string): { 
  productType: string; 
  quantity: number; 
  unitPrice: number; 
  dasNumber: string; 
  deliveryAddress: string; 
  unitOfMeasure: string; 
} {
  // Parsing tipo prodotto (es. GASOLIO AUTOTRAZIONE 10PPM)
  const productMatch = pdfText.match(/(?:GASOLIO|BENZINA|DIESEL|CARBURANTE)[^\n\r]+/i);
  const productType = productMatch ? productMatch[0].trim() : '';
  
  // Parsing numero DAS
  const dasMatch = pdfText.match(/(?:DAS Nr\.|DAS)\s*([A-Z0-9]{20,})/i);
  const dasNumber = dasMatch ? dasMatch[1] : '';
  
  // Parsing quantità (litri) - migliorato per catturare diverse varianti
  let quantity = 0;
  
  // Prima prova: cerca quantità seguita da LITRI
  const quantityLitriMatch = pdfText.match(/(\d+[.,]?\d*)\s*LITRI/i);
  if (quantityLitriMatch) {
    quantity = parseFloat(quantityLitriMatch[1].replace(',', '.'));
  }
  
  // Seconda prova: cerca nella tabella "Quantità" seguito da numero
  if (quantity === 0) {
    const quantitaTableMatch = pdfText.match(/Quantità[\s\S]*?(\d+[.,]?\d*)/i);
    if (quantitaTableMatch) {
      const qValue = parseFloat(quantitaTableMatch[1].replace(',', '.'));
      if (qValue >= 100) { // Solo quantità significative
        quantity = qValue;
      }
    }
  }
  
  // Terza prova: cerca pattern specifico da tabella fattura elettronica
  if (quantity === 0) {
    const tableQuantityMatch = pdfText.match(/(?:GASOLIO|BENZINA|DIESEL|CARBURANTE)[\s\S]*?(\d+[.,]?\d*)\s*1,00\s*(\d+[.,]\d+)\s*LITRI/i);
    if (tableQuantityMatch) {
      quantity = parseFloat(tableQuantityMatch[1].replace(',', '.'));
    }
  }
  
  // Parsing prezzo unitario - migliorato
  let unitPrice = 0;
  
  // Prima prova: cerca "Prezzo unitario"
  const priceMatch = pdfText.match(/Prezzo\s*unitario[\s\S]*?(\d+[.,]\d+)/i);
  if (priceMatch) {
    unitPrice = parseFloat(priceMatch[1].replace(',', '.'));
  }
  
  // Seconda prova: cerca nella riga del prodotto
  if (unitPrice === 0) {
    const productPriceMatch = pdfText.match(/(?:GASOLIO|BENZINA|DIESEL|CARBURANTE)[\s\S]*?1,00[\s\S]*?(\d+[.,]\d+)\s*LITRI/i);
    if (productPriceMatch) {
      unitPrice = parseFloat(productPriceMatch[1].replace(',', '.'));
    }
  }
  
  // Parsing indirizzo destinazione merce (base di carico)
  const deliveryMatch = pdfText.match(/Dest\. merce:\s*([^\n\r]+)/i);
  let deliveryAddress = deliveryMatch ? deliveryMatch[1].trim() : '';
  
  // Se non trova "Dest. merce", usa l'indirizzo del cessionario
  if (!deliveryAddress) {
    const clientAddressMatch = pdfText.match(/Cessionario\/committente[\s\S]*?Indirizzo:\s*([^\n\r]+)/i);
    if (clientAddressMatch) {
      deliveryAddress = clientAddressMatch[1].trim();
    }
  }
  
  const unitOfMeasure = 'LITRI';
  
  console.log('PDF Transport Details parsed:', {
    productType,
    quantity,
    unitPrice,
    dasNumber,
    deliveryAddress,
    unitOfMeasure
  });
  
  return {
    productType,
    quantity,
    unitPrice,
    dasNumber,
    deliveryAddress,
    unitOfMeasure
  };
}

function parseIssuerInfo(pdfText: string): { name: string; taxCode: string; address: string } {
  // Cerca informazioni dell'emittente
  const issuerMatch = pdfText.match(/(?:emittente|mittente|da|from)[\s\:]*([^\n\r]{1,150})/i);
  const name = issuerMatch ? issuerMatch[1].trim() : '';
  
  // Cerca partita IVA/codice fiscale dell'emittente
  const issuerTaxMatch = pdfText.match(/(?:p\.iva|partita iva|codice fiscale|c\.f\.|tax)[\s\:]*([A-Z0-9]{11,16})/i);
  const taxCode = issuerTaxMatch ? issuerTaxMatch[1] : '';
  
  // Cerca indirizzo dell'emittente
  const issuerAddressMatch = pdfText.match(/(?:via|viale|piazza|strada|corso)[\s]*([^\n\r]{1,200})/i);
  const address = issuerAddressMatch ? issuerAddressMatch[1].trim() : '';
  
  return { name, taxCode, address };
}

function parseClientInfo(pdfText: string): { name: string; taxCode: string; address: string } {
  // Cerca informazioni del cliente
  const clientMatch = pdfText.match(/(?:cliente|destinatario|a|to)[\s\:]*([^\n\r]{1,150})/i);
  const name = clientMatch ? clientMatch[1].trim() : '';
  
  // Cerca partita IVA/codice fiscale del cliente
  const clientTaxMatch = pdfText.match(/(?:cliente.*p\.iva|cliente.*partita iva|cliente.*codice fiscale|cliente.*c\.f\.)[\s\:]*([A-Z0-9]{11,16})/i);
  const taxCode = clientTaxMatch ? clientTaxMatch[1] : '';
  
  // Cerca indirizzo del cliente
  const clientAddressMatch = pdfText.match(/(?:cliente.*via|cliente.*viale|cliente.*piazza|cliente.*strada|cliente.*corso)[\s]*([^\n\r]{1,200})/i);
  const address = clientAddressMatch ? clientAddressMatch[1].trim() : '';
  
  return { name, taxCode, address };
}

function parseAmounts(pdfText: string): { netAmount: number; taxAmount: number; totalAmount: number } {
  // Cerca importo totale
  const totalMatch = pdfText.match(/(?:totale|total|da pagare|importo)[\s\:€]*(\d+[,\.]\d{2})/i);
  const totalAmount = totalMatch ? parseFloat(totalMatch[1].replace(',', '.')) : 0;
  
  // Cerca IVA
  const taxMatch = pdfText.match(/(?:iva|vat|imposta)[\s\:€]*(\d+[,\.]\d{2})/i);
  const taxAmount = taxMatch ? parseFloat(taxMatch[1].replace(',', '.')) : 0;
  
  // Calcola netto
  const netAmount = totalAmount - taxAmount;
  
  return { netAmount, taxAmount, totalAmount };
}

// Parsing XML per fatture elettroniche italiane
export function parseInvoiceXML(xmlText: string): ParsedInvoiceData | null {
  try {
    console.log('Parsing fattura elettronica XML italiana...');
    
    // Parsing numero fattura
    const numeroMatch = xmlText.match(/<Numero>([^<]+)<\/Numero>/i);
    const invoiceNumber = numeroMatch ? numeroMatch[1] : '';
    
    // Parsing data documento
    const dataMatch = xmlText.match(/<Data>(\d{4}-\d{2}-\d{2})<\/Data>/i);
    const date = dataMatch ? dataMatch[1] : '';
    
    // Parsing informazioni cedente
    const issuerInfo = parseXMLIssuer(xmlText);
    
    // Parsing informazioni cessionario
    const clientInfo = parseXMLClient(xmlText);
    
    // Parsing importi
    const amounts = parseXMLAmounts(xmlText);
    
    // Parsing causale
    const causaleMatch = xmlText.match(/<Causale>([^<]+)<\/Causale>/i);
    const description = causaleMatch ? causaleMatch[1] : '';
    
    // Parsing data scadenza
    const scadenzaMatch = xmlText.match(/<DataScadenzaPagamento>(\d{4}-\d{2}-\d{2})<\/DataScadenzaPagamento>/i);
    const dueDate = scadenzaMatch ? scadenzaMatch[1] : '';
    
    // Parsing modalità pagamento
    const modalitaMatch = xmlText.match(/<ModalitaPagamento>([^<]+)<\/ModalitaPagamento>/i);
    const paymentTerms = modalitaMatch ? modalitaMatch[1] : '';
    
    // Parsing dettagli trasporto
    const transportDetails = parseXMLTransportDetails(xmlText);
    
    // Parsing linee di dettaglio per fatture complesse
    const invoiceLines = parseXMLInvoiceLines(xmlText);
    
    console.log('Dati fattura XML estratti:', {
      invoiceNumber,
      date,
      issuerInfo,
      clientInfo,
      amounts,
      transportDetails,
      invoiceLines
    });
    
    return {
      invoiceNumber,
      date,
      issuerInfo,
      clientInfo,
      amounts,
      description,
      paymentTerms,
      dueDate,
      transportDetails,
      invoiceLines
    };
    
  } catch (error) {
    console.error('Error parsing invoice XML:', error);
    return null;
  }
}

// Parsing cedente da XML
function parseXMLIssuer(xmlText: string): { name: string; taxCode: string; address: string } {
  // Denominazione cedente
  const nameMatch = xmlText.match(/<CedentePrestatore>[\s\S]*?<Denominazione>([^<]+)<\/Denominazione>/i);
  const name = nameMatch ? nameMatch[1] : '';
  
  // Codice fiscale cedente
  const taxMatch = xmlText.match(/<CedentePrestatore>[\s\S]*?<IdCodice>([^<]+)<\/IdCodice>/i);
  const taxCode = taxMatch ? taxMatch[1] : '';
  
  // Indirizzo cedente
  const addressMatch = xmlText.match(/<CedentePrestatore>[\s\S]*?<Sede>[\s\S]*?<Indirizzo>([^<]+)<\/Indirizzo>/i);
  let address = addressMatch ? addressMatch[1] : '';
  
  // Aggiungi comune e provincia
  const comuneMatch = xmlText.match(/<CedentePrestatore>[\s\S]*?<Comune>([^<]+)<\/Comune>/i);
  const provinciaMatch = xmlText.match(/<CedentePrestatore>[\s\S]*?<Provincia>([^<]+)<\/Provincia>/i);
  if (comuneMatch && provinciaMatch) {
    address += `, ${comuneMatch[1]} (${provinciaMatch[1]})`;
  }
  
  return { name, taxCode, address };
}

// Parsing cessionario da XML
function parseXMLClient(xmlText: string): { name: string; taxCode: string; address: string } {
  // Denominazione cessionario
  const nameMatch = xmlText.match(/<CessionarioCommittente>[\s\S]*?<Denominazione>([^<]+)<\/Denominazione>/i);
  const name = nameMatch ? nameMatch[1] : '';
  
  // Codice fiscale cessionario
  const taxMatch = xmlText.match(/<CessionarioCommittente>[\s\S]*?<IdCodice>([^<]+)<\/IdCodice>/i);
  const taxCode = taxMatch ? taxMatch[1] : '';
  
  // Indirizzo cessionario
  const addressMatch = xmlText.match(/<CessionarioCommittente>[\s\S]*?<Sede>[\s\S]*?<Indirizzo>([^<]+)<\/Indirizzo>/i);
  let address = addressMatch ? addressMatch[1] : '';
  
  // Aggiungi comune e provincia
  const comuneMatch = xmlText.match(/<CessionarioCommittente>[\s\S]*?<Comune>([^<]+)<\/Comune>/i);
  const provinciaMatch = xmlText.match(/<CessionarioCommittente>[\s\S]*?<Provincia>([^<]+)<\/Provincia>/i);
  if (comuneMatch && provinciaMatch) {
    address += `, ${comuneMatch[1]} (${provinciaMatch[1]})`;
  }
  
  return { name, taxCode, address };
}

// Parsing importi da XML
function parseXMLAmounts(xmlText: string): { netAmount: number; taxAmount: number; totalAmount: number } {
  // Totale documento
  const totalMatch = xmlText.match(/<ImportoTotaleDocumento>([^<]+)<\/ImportoTotaleDocumento>/i);
  const totalAmount = totalMatch ? parseFloat(totalMatch[1]) : 0;
  
  // Imposta
  const taxMatch = xmlText.match(/<Imposta>([^<]+)<\/Imposta>/i);
  const taxAmount = taxMatch ? parseFloat(taxMatch[1]) : 0;
  
  // Imponibile
  const netMatch = xmlText.match(/<ImponibileImporto>([^<]+)<\/ImponibileImporto>/i);
  const netAmount = netMatch ? parseFloat(netMatch[1]) : (totalAmount - taxAmount);
  
  return { netAmount, taxAmount, totalAmount };
}

// Parsing dettagli trasporto da XML
function parseXMLTransportDetails(xmlText: string): {
  productType: string;
  quantity: number;
  unitPrice: number;
  dasNumber: string;
  deliveryAddress: string;
  unitOfMeasure: string;
} {
  // Tipo prodotto - cerca nelle descrizioni prodotto
  const productMatch = xmlText.match(/<Descrizione>([^<]*(?:GASOLIO|BENZINA|DIESEL|CARBURANTE)[^<]*)<\/Descrizione>/i);
  const productType = productMatch ? productMatch[1].trim() : '';
  
  // Numero DAS - cerca nella descrizione DAS
  const dasMatch = xmlText.match(/<Descrizione>[^<]*(?:DAS Nr\.|DAS)\s*([A-Z0-9]{20,})[^<]*<\/Descrizione>/i);
  const dasNumber = dasMatch ? dasMatch[1] : '';
  
  // Quantità - cerca il tag Quantita che segue la descrizione del prodotto
  // Prima trova la riga del prodotto, poi cerca la quantità nella stessa riga o quella successiva
  let quantity = 0;
  const detailLines = xmlText.match(/<DettaglioLinee>[\s\S]*?<\/DettaglioLinee>/g) || [];
  
  for (const line of detailLines) {
    // Se questa riga contiene il prodotto carburante
    if (line.match(/<Descrizione>[^<]*(?:GASOLIO|BENZINA|DIESEL|CARBURANTE)[^<]*<\/Descrizione>/i)) {
      const quantityMatch = line.match(/<Quantita>([^<]+)<\/Quantita>/i);
      if (quantityMatch && parseFloat(quantityMatch[1]) > 1) { // Prendi solo quantità significative
        quantity = parseFloat(quantityMatch[1]);
        break;
      }
    }
  }
  
  // Fallback: cerca qualsiasi quantità maggiore di 1000 (tipico per litri)
  if (quantity === 0) {
    const allQuantities = xmlText.match(/<Quantita>([^<]+)<\/Quantita>/g) || [];
    for (const qMatch of allQuantities) {
      const qValue = parseFloat(qMatch.replace(/<\/?Quantita>/g, ''));
      if (qValue >= 1000) { // Quantità tipica per carburante
        quantity = qValue;
        break;
      }
    }
  }
  
  // Unità di misura - cerca nella stessa riga del prodotto
  let unitOfMeasure = 'LITRI';
  for (const line of detailLines) {
    if (line.match(/<Descrizione>[^<]*(?:GASOLIO|BENZINA|DIESEL|CARBURANTE)[^<]*<\/Descrizione>/i)) {
      const unitMatch = line.match(/<UnitaMisura>([^<]+)<\/UnitaMisura>/i);
      if (unitMatch) {
        unitOfMeasure = unitMatch[1];
        break;
      }
    }
  }
  
  // Prezzo unitario - cerca nella stessa riga del prodotto
  let unitPrice = 0;
  for (const line of detailLines) {
    if (line.match(/<Descrizione>[^<]*(?:GASOLIO|BENZINA|DIESEL|CARBURANTE)[^<]*<\/Descrizione>/i)) {
      const priceMatch = line.match(/<PrezzoUnitario>([^<]+)<\/PrezzoUnitario>/i);
      if (priceMatch && parseFloat(priceMatch[1]) > 0) {
        unitPrice = parseFloat(priceMatch[1]);
        break;
      }
    }
  }
  
  // Indirizzo destinazione - cerca nella descrizione "Dest. merce"
  const deliveryMatch = xmlText.match(/<Descrizione>[^<]*Dest\. merce:\s*([^<]+?)\s*<\/Descrizione>/i);
  let deliveryAddress = deliveryMatch ? deliveryMatch[1].trim() : '';
  
  // Se non trovato, usa l'indirizzo del cessionario
  if (!deliveryAddress) {
    const clientAddressMatch = xmlText.match(/<CessionarioCommittente>[\s\S]*?<Indirizzo>([^<]+)<\/Indirizzo>/i);
    if (clientAddressMatch) {
      deliveryAddress = clientAddressMatch[1];
    }
  }
  
  console.log('XML Transport Details parsed:', {
    productType,
    quantity,
    unitPrice,
    dasNumber,
    deliveryAddress,
    unitOfMeasure
  });
  
  return {
    productType,
    quantity,
    unitPrice,
    dasNumber,
    deliveryAddress,
    unitOfMeasure
  };
}

// Parsing linee di dettaglio da XML
function parseXMLInvoiceLines(xmlText: string): InvoiceLine[] {
  const invoiceLines: InvoiceLine[] = [];
  
  try {
    // Cerca tutte le sezioni DettaglioLinee
    const detailSections = xmlText.match(/<DettaglioLinee>[\s\S]*?<\/DettaglioLinee>/g) || [];
    
    for (const section of detailSections) {
      // Estrai numero linea
      const lineNumberMatch = section.match(/<NumeroLinea>([^<]+)<\/NumeroLinea>/i);
      const lineNumber = lineNumberMatch ? parseInt(lineNumberMatch[1]) : 0;
      
      // Estrai codice prodotto
      const productCodeMatch = section.match(/<CodiceArticolo>[\s\S]*?<Valore>([^<]+)<\/Valore>/i);
      const productCode = productCodeMatch ? productCodeMatch[1] : '';
      
      // Estrai descrizione
      const descriptionMatch = section.match(/<Descrizione>([^<]+)<\/Descrizione>/i);
      const description = descriptionMatch ? descriptionMatch[1] : '';
      
      // Estrai quantità
      const quantityMatch = section.match(/<Quantita>([^<]+)<\/Quantita>/i);
      const quantity = quantityMatch ? parseFloat(quantityMatch[1]) : 0;
      
      // Estrai unità di misura
      const unitMatch = section.match(/<UnitaMisura>([^<]+)<\/UnitaMisura>/i);
      const unitOfMeasure = unitMatch ? unitMatch[1] : '';
      
      // Estrai valore unitario
      const unitValueMatch = section.match(/<PrezzoUnitario>([^<]+)<\/PrezzoUnitario>/i);
      const unitValue = unitValueMatch ? parseFloat(unitValueMatch[1]) : 0;
      
      // Estrai valore totale
      const totalValueMatch = section.match(/<PrezzoTotale>([^<]+)<\/PrezzoTotale>/i);
      const totalValue = totalValueMatch ? parseFloat(totalValueMatch[1]) : 0;
      
      // Estrai aliquota IVA
      const vatRateMatch = section.match(/<AliquotaIVA>([^<]+)<\/AliquotaIVA>/i);
      const vatRate = vatRateMatch ? parseFloat(vatRateMatch[1]) : 0;
      
      // Estrai dati aggiuntivi
      const additionalDataMatch = section.match(/<AltriDatiGestionali>[\s\S]*?<\/AltriDatiGestionali>/i);
      const additionalData = additionalDataMatch ? additionalDataMatch[0] : '';
      
      // Solo aggiungi linee con dati significativi
      if (lineNumber > 0 && description && quantity > 0) {
        invoiceLines.push({
          lineNumber,
          productCode,
          description,
          quantity,
          unitOfMeasure,
          unitValue,
          totalValue,
          vatRate,
          additionalData
        });
      }
    }
    
    console.log('XML Invoice Lines parsed:', invoiceLines.length, 'lines');
    return invoiceLines;
    
  } catch (error) {
    console.error('Error parsing XML invoice lines:', error);
    return [];
  }
}

// Parsing linee di dettaglio da PDF
function parsePDFInvoiceLines(pdfText: string): InvoiceLine[] {
  const invoiceLines: InvoiceLine[] = [];
  
  try {
    // Pattern per riconoscere le linee di dettaglio nel testo PDF
    // Cerca pattern: "Nr. linea: X" seguito dai dettagli
    const lineMatches = pdfText.match(/Nr\.\s*linea:\s*(\d+)[\s\S]*?(?=Nr\.\s*linea:|\nDati di riepilogo|$)/gi) || [];
    
    for (const lineText of lineMatches) {
      // Estrai numero linea
      const lineNumberMatch = lineText.match(/Nr\.\s*linea:\s*(\d+)/i);
      const lineNumber = lineNumberMatch ? parseInt(lineNumberMatch[1]) : 0;
      
      // Estrai codice prodotto
      const productCodeMatch = lineText.match(/Codifica articolo.*?Valore:\s*([^\s\n]+)/i);
      const productCode = productCodeMatch ? productCodeMatch[1] : '';
      
      // Estrai descrizione
      const descriptionMatch = lineText.match(/Descrizione bene\/servizio:\s*([^\n]+)/i);
      const description = descriptionMatch ? descriptionMatch[1].trim() : '';
      
      // Estrai quantità
      const quantityMatch = lineText.match(/Quantità:\s*(\d+(?:[.,]\d+)?)/i);
      const quantity = quantityMatch ? parseFloat(quantityMatch[1].replace(',', '.')) : 0;
      
      // Estrai unità di misura
      const unitMatch = lineText.match(/Unità di misura:\s*([^\n]+)/i);
      const unitOfMeasure = unitMatch ? unitMatch[1].trim() : '';
      
      // Estrai valore unitario
      const unitValueMatch = lineText.match(/Valore unitario:\s*(\d+(?:[.,]\d+)?)/i);
      const unitValue = unitValueMatch ? parseFloat(unitValueMatch[1].replace(',', '.')) : 0;
      
      // Estrai valore totale
      const totalValueMatch = lineText.match(/Valore totale:\s*(\d+(?:[.,]\d+)?)/i);
      const totalValue = totalValueMatch ? parseFloat(totalValueMatch[1].replace(',', '.')) : 0;
      
      // Estrai IVA
      const vatRateMatch = lineText.match(/IVA \(%\):\s*(\d+(?:[.,]\d+)?)/i);
      const vatRate = vatRateMatch ? parseFloat(vatRateMatch[1].replace(',', '.')) : 0;
      
      // Estrai dati aggiuntivi
      const additionalDataMatch = lineText.match(/Altri dati gestionali([\s\S]*?)(?=Nr\.\s*linea:|$)/i);
      const additionalData = additionalDataMatch ? additionalDataMatch[1].trim() : '';
      
      // Solo aggiungi linee con dati significativi
      if (lineNumber > 0 && description && quantity > 0) {
        invoiceLines.push({
          lineNumber,
          productCode,
          description,
          quantity,
          unitOfMeasure,
          unitValue,
          totalValue,
          vatRate,
          additionalData
        });
      }
    }
    
    console.log('PDF Invoice Lines parsed:', invoiceLines.length, 'lines');
    return invoiceLines;
    
  } catch (error) {
    console.error('Error parsing PDF invoice lines:', error);
    return [];
  }
}

export async function parseInvoiceWithAI(file: File): Promise<ParsedInvoiceData | null> {
  const formData = new FormData();
  formData.append('image', file);

  try {
    const response = await fetch('/api/parse-invoice', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error from API:', errorText);
      alert(`Error from API: ${errorText}`);
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();
    if (data.error) {
      console.error('Error from API:', data.details);
      alert(`Error from API: ${data.details}`);
      return null;
    }
    return data as ParsedInvoiceData;
  } catch (error) {
    console.error('Error parsing invoice with AI:', error);
    alert('Failed to parse invoice with AI. Check the console for more details.');
    return null;
  }
}