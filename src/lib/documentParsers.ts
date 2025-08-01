import OpenAI from 'openai';
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import { ParsedLoadingNoteData, ParsedEDASData } from '@/lib/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Path to service account key file (best practice per sicurezza)
const serviceAccountKeyPath = './tidal-glider-465915-e6-7d63dd15c624.json';

// Initialize Google Cloud Document AI client with EU endpoint and key file
const documentAIClient = new DocumentProcessorServiceClient({
  apiEndpoint: 'eu-documentai.googleapis.com',
  keyFilename: serviceAccountKeyPath
});

/**
 * Parses a loading note image to extract structured data using Google Cloud Document AI.
 * @param base64Image The base64-encoded image string.
 * @param mimeType The MIME type of the image.
 * @returns A promise that resolves to the parsed loading note data.
 */
export async function parseLoadingNote(base64Image: string, mimeType: string): Promise<ParsedLoadingNoteData> {
  console.log('🔍 Inizio parsing Loading Note con Google Cloud Document AI...');

  // Configuration - hardcoded values from petrolisNDC processor
  const projectId = 'tidal-glider-465915-e6';
  const location = 'eu';
  const processorId = 'd9befe118d921091';

  const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;

  console.log('📋 Document AI Configuration:');
  console.log('Processor Name: petrolisNDC');
  console.log('Processor Type: Custom Extractor');
  console.log('API Endpoint: eu-documentai.googleapis.com');
  console.log('Project ID:', projectId);
  console.log('Location:', location);
  console.log('Processor ID:', processorId);
  console.log('Service Account: petrolisocr@tidal-glider-465915-e6.iam.gserviceaccount.com');
  console.log('🔧 Private Key Fixed: Literal \\n converted to newlines');
  console.log('Full Processor Path:', name);

  try {
    // Process the document with Document AI
    const request = {
      name,
      rawDocument: {
        content: base64Image,
        mimeType: mimeType,
      },
    };

    console.log('📤 Inviando richiesta a Document AI...');
    const [result] = await documentAIClient.processDocument(request);
    const { document } = result;

    if (!document) {
      throw new Error('No document returned from Document AI');
    }

    console.log('📄 RAW RESPONSE da Document AI (Loading Note):');
    console.log('===============================================');
    console.log('Text length:', document.text?.length || 0);
    console.log('Pages:', document.pages?.length || 0);
    console.log('Entities:', document.entities?.length || 0);
    console.log('Form fields:', document.pages?.[0]?.formFields?.length || 0);
    console.log('Tables:', document.pages?.[0]?.tables?.length || 0);
    console.log('===============================================');

    // Extract key-value pairs and entities
    const formFields = document.pages?.[0]?.formFields || [];
    const entities = document.entities || [];
    const documentText = document.text || '';

    // Helper function to extract text from TextAnchor
    const getText = (textAnchor: any) => {
      if (!textAnchor?.textSegments || textAnchor.textSegments.length === 0) {
        return '';
      }
      const segment = textAnchor.textSegments[0];
      const startIndex = segment.startIndex || 0;
      const endIndex = segment.endIndex || 0;
      return documentText.substring(Number(startIndex), Number(endIndex)).trim();
    };

    // Create a map of form fields for easier lookup
    const fieldMap: Record<string, string> = {};
    formFields.forEach((field: any) => {
      const fieldName = getText(field.fieldName).toLowerCase();
      const fieldValue = getText(field.fieldValue);
      if (fieldName && fieldValue) {
        fieldMap[fieldName] = fieldValue;
      }
    });

    // Create a map of entities for easier lookup
    const entityMap: Record<string, string[]> = {};
    entities.forEach((entity: any) => {
      const entityType = entity.type || '';
      const entityValue = getText(entity.textAnchor);
      if (entityType && entityValue) {
        if (!entityMap[entityType]) {
          entityMap[entityType] = [];
        }
        entityMap[entityType].push(entityValue);
      }
    });

    console.log('🔍 CAMPI ESTRATTI (Form Fields):');
    console.log('================================');
    Object.entries(fieldMap).forEach(([key, value]) => {
      console.log(`${key}: ${value}`);
    });
    console.log('================================');

    console.log('🔍 ENTITÀ ESTRATTE (Entities):');
    console.log('===============================');
    Object.entries(entityMap).forEach(([type, values]) => {
      console.log(`${type}: ${values.join(', ')}`);
    });
    console.log('===============================');

    // Map Document AI results to our LoadingNoteData structure
    // Using exact field names from petrolisNDC processor configuration
    const parsedData: ParsedLoadingNoteData = {
      // Document number - use das field (same as EDAS)
      documentNumber: findFieldValue(['das'], fieldMap, entityMap) || 
                     extractFirstValue(entityMap['id']) || '',

      // Loading date - use exact 'data' field from Document AI
      loadingDate: findFieldValue(['data'], fieldMap, entityMap) || 
                  extractFirstValue(entityMap['date_time']) || '',

      // Carrier name - use exact 'vettore' field
      carrierName: findFieldValue(['vettore'], fieldMap, entityMap) || 
                  extractFirstValue(entityMap['organization']) || '',

      // Shipper name - use 'deposito' field (Fornitore)
      shipperName: findFieldValue(['deposito'], fieldMap, entityMap) || '',

      // Consignee name - use exact 'destinazione' field
      consigneeName: findFieldValue(['destinazione'], fieldMap, entityMap) || 
                    extractFirstValue(entityMap['person']) || '',

      // Product description - use exact 'prodotto' field
      productDescription: findFieldValue(['prodotto'], fieldMap, entityMap) || '',

      // Weight - use exact 'qnt-in-kg' field for both gross and net
      grossWeightKg: parseNumber(findFieldValue(['qnt-in-kg'], fieldMap, entityMap)) || 0,
      netWeightKg: parseNumber(findFieldValue(['qnt-in-kg'], fieldMap, entityMap)) || 0,
      
      // Volume - use exact 'quantita-consegnata' field and convert to number
      volumeLiters: parseNumber(findFieldValue(['quantita-consegnata'], fieldMap, entityMap)) || 0,

      // Notes include driver and density info
      notes: `Autista: ${findFieldValue(['autista'], fieldMap, entityMap) || 'N/A'} | ` +
             `Densità 15°C: ${findFieldValue(['densita-15'], fieldMap, entityMap) || 'N/A'} | ` +
             `Densità ambiente: ${findFieldValue(['densita-ambiente'], fieldMap, entityMap) || 'N/A'}`,
      
      // Campi aggiuntivi dalle entità estratte
      densityAt15C: parseNumber(findFieldValue(['densita-15'], fieldMap, entityMap)) || 0,
      densityAtAmbientTemp: parseNumber(findFieldValue(['densita-ambiente'], fieldMap, entityMap)) || 0,
      committenteName: findFieldValue(['committente'], fieldMap, entityMap) || '',
      companyName: findFieldValue(['societa'], fieldMap, entityMap) || '',
      depotLocation: findFieldValue(['deposito'], fieldMap, entityMap) || '',
      supplierLocation: findFieldValue(['fornitore'], fieldMap, entityMap) || '',
      driverName: findFieldValue(['autista'], fieldMap, entityMap) || '',
      destinationName: findFieldValue(['destinatario'], fieldMap, entityMap) || '',
    };

    // If netWeightKg is 0, use grossWeightKg
    if (parsedData.netWeightKg === 0 && parsedData.grossWeightKg > 0) {
      parsedData.netWeightKg = parsedData.grossWeightKg;
    }

    console.log('✅ DATI PARSATI (Loading Note):');
    console.log('===============================');
    console.log('Document Number:', parsedData.documentNumber);
    console.log('Loading Date:', parsedData.loadingDate);
    console.log('Carrier Name:', parsedData.carrierName);
    console.log('Shipper Name:', parsedData.shipperName);
    console.log('Consignee Name:', parsedData.consigneeName);
    console.log('Product Description:', parsedData.productDescription);
    console.log('Gross Weight (kg):', parsedData.grossWeightKg);
    console.log('Net Weight (kg):', parsedData.netWeightKg);
    console.log('Volume (liters):', parsedData.volumeLiters);
    console.log('Driver Name:', parsedData.driverName);
    console.log('Density at 15°C:', parsedData.densityAt15C);
    console.log('Density at Ambient Temp:', parsedData.densityAtAmbientTemp);
    console.log('Committente:', parsedData.committenteName);
    console.log('Company Name:', parsedData.companyName);
    console.log('Depot Location:', parsedData.depotLocation);
    console.log('Supplier Location:', parsedData.supplierLocation);
    console.log('Destination Name:', parsedData.destinationName);
    console.log('Notes length:', parsedData.notes.length);
    console.log('===============================');

    return parsedData;

  } catch (error) {
    console.error('❌ ERRORE nel processamento Document AI (Loading Note):', error);
    throw new Error(`Failed to process document with Document AI: ${error}`);
  }
}

/**
 * Helper function to find a field value by checking entities first, then form fields
 */
function findFieldValue(possibleNames: string[], fieldMap: Record<string, string>, entityMap: Record<string, string[]> = {}): string | null {
  // First try to find in entities (more accurate for our processors)
  for (const name of possibleNames) {
    for (const [entityType, entityValues] of Object.entries(entityMap)) {
      if (entityType.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(entityType.toLowerCase())) {
        return entityValues.length > 0 ? entityValues[0] : null;
      }
    }
  }
  
  // Fallback to form fields
  for (const name of possibleNames) {
    for (const [fieldName, fieldValue] of Object.entries(fieldMap)) {
      if (fieldName.includes(name) || name.includes(fieldName)) {
        return fieldValue;
      }
    }
  }
  return null;
}

/**
 * Helper function to extract the first value from an entity array
 */
function extractFirstValue(values: string[] | undefined): string | null {
  return values && values.length > 0 ? values[0] : null;
}

/**
 * Helper function to parse a string as a number
 * Handles Italian number format and multiple values separated by comma
 */
function parseNumber(value: string | null): number {
  if (!value) return 0;
  
  // If multiple values separated by comma, take the first one (but handle comma as decimal separator)
  let firstValue = value.trim();
  
  // Check if we have multiple numbers separated by comma (like "4.000, 3.954")
  // If the comma is followed by a space and more digits, it's a separator between values
  const commaSpacePattern = /,\s+\d/;
  if (commaSpacePattern.test(firstValue)) {
    firstValue = firstValue.split(',')[0].trim();
  }
  
  // Clean: remove non-numeric chars except dots and commas
  const cleaned = firstValue.replace(/[^\d.,]/g, '');
  
  // Handle Italian number format:
  // - Dots are thousand separators (4.000 = 4000)
  // - Commas are decimal separators (4,5 = 4.5)
  let normalizedNumber = cleaned;
  
  // If there's a comma, it's the decimal separator
  if (normalizedNumber.includes(',')) {
    // Replace dots (thousand separators) with empty string, then comma with dot
    normalizedNumber = normalizedNumber.replace(/\./g, '').replace(',', '.');
  } else if (normalizedNumber.includes('.')) {
    // If only dots and no comma, check if it's a decimal or thousand separator
    // If there are 3 digits after the last dot, it's likely a thousand separator
    const lastDotIndex = normalizedNumber.lastIndexOf('.');
    const digitsAfterLastDot = normalizedNumber.length - lastDotIndex - 1;
    
    if (digitsAfterLastDot === 3 && !normalizedNumber.substring(0, lastDotIndex).includes('.')) {
      // Single dot with exactly 3 digits after = thousand separator (e.g., "4.000")
      normalizedNumber = normalizedNumber.replace('.', '');
    } else if (digitsAfterLastDot === 3) {
      // Multiple dots with 3 digits after last = thousand separators (e.g., "1.234.567")
      normalizedNumber = normalizedNumber.replace(/\./g, '');
    }
    // Otherwise assume it's a decimal separator
  }
  
  const parsed = parseFloat(normalizedNumber);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Parses an e-DAS document image to extract structured data.
 * @param base64Image The base64-encoded image string.
 * @param mimeType The MIME type of the image.
 * @returns A promise that resolves to the parsed e-DAS data.
 */
export async function parseEdas(base64Image: string, mimeType: string): Promise<ParsedEDASData> {
  try {
    console.log('🔍 Inizio parsing e-DAS con Google Cloud Document AI...');
    
    // Configuration - processore EDAS
    const projectId = 'tidal-glider-465915-e6';
    const location = 'eu';
    const processorId = 'cb0cd41d387b97ec'; // Processore per EDAS
    
    const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;
    
    console.log('📋 Document AI Configuration (EDAS):');
    console.log('Processor Name: petrolisEDAS');
    console.log('Processor Type: Custom Extractor');
    console.log('API Endpoint: eu-documentai.googleapis.com');
    console.log('Project ID:', projectId);
    console.log('Location:', location);
    console.log('Processor ID:', processorId);
    console.log('Service Account: petrolisocr@tidal-glider-465915-e6.iam.gserviceaccount.com');
    console.log('Full Processor Path:', name);

    // Convert base64 to Buffer
    const imageBuffer = Buffer.from(base64Image, 'base64');

    // Process the document
    const [result] = await documentAIClient.processDocument({
      name: name,
      rawDocument: {
        content: imageBuffer,
        mimeType: mimeType,
      },
    });

    const { document } = result;
    if (!document) {
      throw new Error('No document returned from Document AI');
    }

    console.log('📄 RAW RESPONSE da Document AI (e-DAS):');
    console.log('===============================================');
    console.log('Text length:', document.text?.length || 0);
    console.log('Pages:', document.pages?.length || 0);
    console.log('Entities:', document.entities?.length || 0);
    console.log('Form fields:', document.pages?.[0]?.formFields?.length || 0);
    console.log('Tables:', document.pages?.[0]?.tables?.length || 0);
    console.log('===============================================');

    // Extract key-value pairs and entities
    const formFields = document.pages?.[0]?.formFields || [];
    const entities = document.entities || [];
    const documentText = document.text || '';

    // Helper function to extract text from TextAnchor
    const getText = (textAnchor: any) => {
      if (!textAnchor?.textSegments || textAnchor.textSegments.length === 0) {
        return '';
      }
      const segment = textAnchor.textSegments[0];
      const startIndex = segment.startIndex || 0;
      const endIndex = segment.endIndex || 0;
      return documentText.substring(Number(startIndex), Number(endIndex)).trim();
    };

    // Create a map of form fields for easier lookup
    const fieldMap: Record<string, string> = {};
    formFields.forEach((field: any) => {
      const fieldName = getText(field.fieldName).toLowerCase();
      const fieldValue = getText(field.fieldValue);
      if (fieldName && fieldValue) {
        fieldMap[fieldName] = fieldValue;
      }
    });

    // Create a map of entities for easier lookup
    const entityMap: Record<string, string[]> = {};
    entities.forEach((entity: any) => {
      const entityType = entity.type || '';
      const entityValue = getText(entity.textAnchor);
      if (entityType && entityValue) {
        if (!entityMap[entityType]) {
          entityMap[entityType] = [];
        }
        entityMap[entityType].push(entityValue);
      }
    });

    console.log('🔍 CAMPI ESTRATTI (Form Fields) - EDAS:');
    console.log('========================================');
    Object.entries(fieldMap).forEach(([key, value]) => {
      console.log(`${key}: ${value}`);
    });
    console.log('========================================');

    console.log('🔍 ENTITÀ ESTRATTE (Entities) - EDAS:');
    console.log('======================================');
    Object.entries(entityMap).forEach(([type, values]) => {
      console.log(`${type}: ${values.join(', ')}`);
    });
    console.log('======================================');

    // Map Document AI results to ParsedEDASData structure
    // Using exact field names from petrolisEDAS processor configuration
    const parsedData: ParsedEDASData = {
      documentInfo: {
        dasNumber: findFieldValue(['das-n'], fieldMap, entityMap) || '',
        version: findFieldValue(['version', 'versione'], fieldMap, entityMap) || '1',
        localReferenceNumber: findFieldValue(['riferimento', 'reference'], fieldMap, entityMap) || '',
        invoiceNumber: findFieldValue(['fattura', 'invoice'], fieldMap, entityMap) || '',
        invoiceDate: findFieldValue(['data', 'date'], fieldMap, entityMap) || '',
        registrationDateTime: findFieldValue(['registrazione', 'registration'], fieldMap, entityMap) || '',
        shippingDateTime: findFieldValue(['data-e-ora-di-spedizione'], fieldMap, entityMap) || '',
        validityExpirationDateTime: findFieldValue(['scadenza', 'expiration'], fieldMap, entityMap) || '',
      },
      senderInfo: {
        depositoMittenteCode: findFieldValue(['deposito-mittente'], fieldMap, entityMap) || '',
        name: findFieldValue(['nome', 'name', 'sender'], fieldMap, entityMap) || extractFirstValue(entityMap['organization']) || '',
        address: findFieldValue(['indirizzo', 'address'], fieldMap, entityMap) || '',
        organizationName: extractFirstValue(entityMap['organization']) || '', // ENI SPA, etc.
      },
      depositorInfo: {
        name: findFieldValue(['depositante'], fieldMap, entityMap) || '',
        id: findFieldValue(['id', 'codice'], fieldMap, entityMap) || '',
        location: extractFirstValue(entityMap['location']) || '', // VILLA S. LUCIA, etc.
      },
      recipientInfo: {
        name: findFieldValue(['destinatario'], fieldMap, entityMap) || extractFirstValue(entityMap['person']) || '',
        address: findFieldValue(['indirizzo', 'address'], fieldMap, entityMap) || '',
        taxCode: findFieldValue(['impianto-ricevente'], fieldMap, entityMap) || '',
        facilityCode: findFieldValue(['impianto-ricevente'], fieldMap, entityMap) || '', // codice impianto ricevente
      },
      transportInfo: {
        transportManager: findFieldValue(['gestore', 'manager'], fieldMap, entityMap) || '',
        transportMode: findFieldValue(['modalità', 'mode'], fieldMap, entityMap) || '',
        vehicleType: findFieldValue(['tipo', 'type'], fieldMap, entityMap) || '',
        vehicleId: findFieldValue(['veicolo', 'vehicle'], fieldMap, entityMap) || '',
        estimatedDuration: findFieldValue(['durata', 'duration'], fieldMap, entityMap) || '',
        firstCarrierName: findFieldValue(['vettore', 'carrier'], fieldMap, entityMap) || '',
        firstCarrierId: findFieldValue(['vettore', 'carrier'], fieldMap, entityMap) || '',
        driverName: findFieldValue(['primo-incaricato-del-trasporto'], fieldMap, entityMap) || extractFirstValue(entityMap['person']) || '',
      },
      productInfo: {
        productCode: findFieldValue(['codice', 'code'], fieldMap, entityMap) || '',
        description: findFieldValue(['prodotto'], fieldMap, entityMap) || '',
        unCode: findFieldValue(['un', 'code'], fieldMap, entityMap) || '',
        netWeightKg: parseNumber(findFieldValue(['peso-netto-kg'], fieldMap, entityMap)) || 0,
        volumeAtAmbientTempL: parseNumber(findFieldValue(['volume-temp-ambiente'], fieldMap, entityMap)) || 0,
        volumeAt15CL: parseNumber(findFieldValue(['volume-a-15'], fieldMap, entityMap)) || 0,
        densityAtAmbientTemp: parseNumber(findFieldValue(['densita-a-temp-ambiente-lt'], fieldMap, entityMap)) || 0,
        densityAt15C: parseNumber(findFieldValue(['densità', 'density'], fieldMap, entityMap)) || 0,
      },
    };

    console.log('✅ DATI PARSATI (e-DAS):');
    console.log('========================');
    console.log('DAS Number:', parsedData.documentInfo.dasNumber);
    console.log('Invoice Date:', parsedData.documentInfo.invoiceDate);
    console.log('Sender Name:', parsedData.senderInfo.name);
    console.log('Organization Name:', parsedData.senderInfo.organizationName);
    console.log('Depositor Location:', parsedData.depositorInfo.location);
    console.log('Recipient Name:', parsedData.recipientInfo.name);
    console.log('Facility Code:', parsedData.recipientInfo.facilityCode);
    console.log('Product Description:', parsedData.productInfo.description);
    console.log('Net Weight (kg):', parsedData.productInfo.netWeightKg);
    console.log('Volume at 15°C (L):', parsedData.productInfo.volumeAt15CL);
    console.log('Volume at Ambient Temp (L):', parsedData.productInfo.volumeAtAmbientTempL);
    console.log('Density at Ambient Temp:', parsedData.productInfo.densityAtAmbientTemp);
    console.log('Density at 15°C:', parsedData.productInfo.densityAt15C);
    console.log('Driver Name:', parsedData.transportInfo.driverName);
    console.log('Vehicle ID:', parsedData.transportInfo.vehicleId);
    console.log('========================');

    return parsedData;

  } catch (error) {
    console.error('❌ ERRORE nel processamento Document AI (e-DAS):', error);
    throw new Error(`Failed to process EDAS document with Document AI: ${error}`);
  }
} 