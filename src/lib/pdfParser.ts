import { ParsedPDFData, ParsedPDFOrder } from './types';

// Estrazione del testo PDF usando pdfjs-dist
export async function parsePDFText(file: File): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      // Dinamically import pdfjs-dist per ridurre il bundle size
      const pdfjsLib = await import('pdfjs-dist');
      
      // Configurazione del worker usando la versione corretta
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.3.31/pdf.worker.min.mjs`;
      
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let fullText = '';
      
      // Estrai testo da tutte le pagine
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        
        fullText += pageText + '\n';
      }
      
      console.log('Testo estratto dal PDF:', fullText); // Debug
      resolve(fullText);
    } catch (error) {
      console.error('Error extracting PDF text:', error);
      reject(new Error('Errore nell\'estrazione del testo dal PDF'));
    }
  });
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