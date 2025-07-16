import OpenAI from 'openai';
import { ParsedLoadingNoteData, ParsedEDASData } from '@/lib/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Parses a loading note image to extract structured data.
 * @param base64Image The base64-encoded image string.
 * @param mimeType The MIME type of the image.
 * @returns A promise that resolves to the parsed loading note data.
 */
export async function parseLoadingNote(base64Image: string, mimeType: string): Promise<ParsedLoadingNoteData> {
  const prompt = `
    You are an expert data extractor. Analyze the provided image, which is a "Nota di Carico" (loading note or bill of lading), and extract the information in JSON format.
    The JSON object must strictly follow this TypeScript interface:

    interface ParsedLoadingNoteData {
      documentNumber: string; // e.g., "NC-2025-00123"
      loadingDate: string; // e.g., "10/07/2025"
      carrierName: string; // e.g., "NewLogistic S.R.L."
      shipperName: string; // e.g., "DE LORENZO CARBURANTI S.R.L."
      consigneeName: string; // e.g., "D'URZO DOMENICO"
      productDescription: string; // e.g., "GASOLIO 10PPM AGRICOLO"
      grossWeightKg: number; // e.g., 8350
      netWeightKg: number; // e.g., 8200
      volumeLiters: number; // e.g., 10000
      notes: string; // Any additional notes or comments
    }

    Extract all fields accurately. If a field is not present, return an empty string "" for string types, 0 for number types, or null.
    The final output must be only the JSON object, without any other text or explanations.
  `;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
            },
          },
        ],
      },
    ],
    max_tokens: 4000,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0].message?.content;
  if (!content) {
    throw new Error('No content from OpenAI');
  }

  return JSON.parse(content);
}

/**
 * Parses an e-DAS document image to extract structured data.
 * @param base64Image The base64-encoded image string.
 * @param mimeType The MIME type of the image.
 * @returns A promise that resolves to the parsed e-DAS data.
 */
export async function parseEdas(base64Image: string, mimeType: string): Promise<ParsedEDASData> {
  const prompt = `
    You are an expert data extractor. Analyze the provided image, which is an e-DAS shipping document, and extract the information in JSON format.
    The JSON object must strictly follow this TypeScript interface:

    interface ParsedEDASData {
      documentInfo: {
        dasNumber: string; // e.g., "25IT9436490VVY00143T1"
        version: string; // e.g., "1"
        localReferenceNumber: string; // e.g., "20250710..0062516/2020"
        invoiceNumber: string; // e.g., "..0062516/2020"
        invoiceDate: string; // e.g., "10/07/2025"
        registrationDateTime: string; // e.g., "10/07/2025 08:20:49"
        shippingDateTime: string; // e.g., "10/07/2025 08:34:00"
        validityExpirationDateTime: string; // e.g., "11/07/2025 02:34:00"
      };
      senderInfo: {
        depositoMittenteCode: string; // e.g., "IT00VVY00143T"
        name: string; // e.g., "DE LORENZO CARBURANTI S.R.L."
        address: string; // e.g., "S.P. PER TROPESA KM 22+827 E KM 22+917 SN 89900 VIBO VALENTIA"
      };
      depositorInfo: {
        name: string; // e.g., "GEAVIS SRL"
        id: string; // e.g., "IT01776680660"
      };
      recipientInfo: {
        name: string; // e.g., "D'URZO DOMENICO"
        address: string; // e.g., "VIA MELISSANDRA, 27 89900 VIBO VALENTIA"
        taxCode: string; // e.g., "IT03949420792"
      };
      transportInfo: {
        transportManager: string; // e.g., "Proprietario dei prodotti"
        transportMode: string; // e.g., "Trasporto stradale"
        vehicleType: string; // e.g., "Veicolo"
        vehicleId: string; // e.g., "IT BH442WZ"
        estimatedDuration: string; // e.g., "18 Ore"
        firstCarrierName: string; // e.g., "NEWLOGISTIC DI D'ASCOLI EUGENIA"
        firstCarrierId: string; // e.g., "IT03396340790"
        driverName: string; // e.g., "MAZZITELLI ANTONIO"
      };
      productInfo: {
        productCode: string; // e.g., "E44027102011S135"
        description: string; // e.g., "GASOLIO 10PPM AGRICOLO"
        unCode: string; // e.g., "UN 1202"
        netWeightKg: number; // e.g., 82
        volumeAtAmbientTempL: number; // volume a temperatura ambiente e.g., 2000
        volumeAt15CL: number; // volume a 15°C e.g., 99
        densityAtAmbientTemp: number; // densità a temperatura ambiente e.g., 815.00
        densityAt15C: number; // densità a 15°C e.g., 824.90
      };
    }

    Extract all fields accurately. If a field is not present, return an empty string "" for string types, 0 for number types, or null.
    The final output must be only the JSON object, without any other text or explanations.
  `;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o', // Using gpt-4o for better performance
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
            },
          },
        ],
      },
    ],
    max_tokens: 4000,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0].message?.content;
  if (!content) {
    throw new Error('No content from OpenAI');
  }

  return JSON.parse(content);
} 