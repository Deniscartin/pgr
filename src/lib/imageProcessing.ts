// Image processing utilities for document scanning
// Handles edge detection, cropping, and cloud storage upload

export interface ProcessedImage {
  originalUrl: string;
  processedUrl: string;
  timestamp: Date;
  documentType: 'edas' | 'loadingNote' | 'cartelloCounter';
}

export interface DocumentProcessingResult {
  processed_image: string;
  original_image: string;
  processed: boolean;
  success?: boolean;
  warning?: string;
  error?: string;
}

/**
 * Processes an image file to detect document edges and crop accordingly
 * Simulates document scanner functionality
 */
export const processDocumentImage = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      try {
        // Set canvas size to image size
        canvas.width = img.width;
        canvas.height = img.height;
        
        if (!ctx) {
          throw new Error('Canvas context not available');
        }
        
        // Draw original image
        ctx.drawImage(img, 0, 0);
        
        // Get image data for processing
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Apply edge detection and document cropping
        const processedImageData = detectAndCropDocument(imageData);
        
        // Put processed data back to canvas
        ctx.putImageData(processedImageData, 0, 0);
        
        // Convert to blob
        canvas.toBlob((blob) => {
          if (blob) {
            const processedFile = new File([blob], file.name, { type: 'image/jpeg' });
            resolve(URL.createObjectURL(processedFile));
          } else {
            reject(new Error('Failed to process image'));
          }
        }, 'image/jpeg', 0.9);
        
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
};

/**
 * Detects document edges and crops the image accordingly
 * Simulates advanced document scanner edge detection
 */
const detectAndCropDocument = (imageData: ImageData): ImageData => {
  const { data, width, height } = imageData;
  
  // Convert to grayscale for edge detection
  const grayData = new Uint8ClampedArray(width * height);
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    grayData[i / 4] = gray;
  }
  
  // Apply Sobel edge detection
  const edges = applySobelFilter(grayData, width, height);
  
  // Find document boundaries
  const bounds = findDocumentBounds(edges, width, height);
  
  // Crop and enhance the document area
  return cropAndEnhance(imageData, bounds);
};

/**
 * Applies Sobel filter for edge detection
 */
const applySobelFilter = (grayData: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray => {
  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  const edges = new Uint8ClampedArray(width * height);
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0, gy = 0;
      
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = (y + ky) * width + (x + kx);
          const kernelIdx = (ky + 1) * 3 + (kx + 1);
          gx += grayData[idx] * sobelX[kernelIdx];
          gy += grayData[idx] * sobelY[kernelIdx];
        }
      }
      
      const magnitude = Math.sqrt(gx * gx + gy * gy);
      edges[y * width + x] = Math.min(255, magnitude);
    }
  }
  
  return edges;
};

/**
 * Finds document boundaries using edge data
 */
const findDocumentBounds = (edges: Uint8ClampedArray, width: number, height: number) => {
  // Simplified document detection - finds the largest rectangular area with strong edges
  // In a real implementation, this would use more sophisticated algorithms like Hough transform
  
  const threshold = 50;
  let minX = width, maxX = 0, minY = height, maxY = 0;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (edges[y * width + x] > threshold) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }
  
  // Add some padding and ensure bounds are valid
  const padding = Math.min(width, height) * 0.05;
  return {
    x: Math.max(0, minX - padding),
    y: Math.max(0, minY - padding),
    width: Math.min(width, maxX - minX + 2 * padding),
    height: Math.min(height, maxY - minY + 2 * padding)
  };
};

/**
 * Crops and enhances the document area
 */
const cropAndEnhance = (imageData: ImageData, bounds: { x: number; y: number; width: number; height: number }): ImageData => {
  const { data, width } = imageData;
  const { x, y, width: cropWidth, height: cropHeight } = bounds;
  
  const croppedData = new ImageData(Math.floor(cropWidth), Math.floor(cropHeight));
  const croppedPixels = croppedData.data;
  
  for (let cy = 0; cy < cropHeight; cy++) {
    for (let cx = 0; cx < cropWidth; cx++) {
      const sourceX = Math.floor(x + cx);
      const sourceY = Math.floor(y + cy);
      const sourceIdx = (sourceY * width + sourceX) * 4;
      const targetIdx = (cy * cropWidth + cx) * 4;
      
      if (sourceIdx >= 0 && sourceIdx < data.length - 3) {
        // Copy and enhance pixels
        croppedPixels[targetIdx] = enhancePixel(data[sourceIdx]);     // R
        croppedPixels[targetIdx + 1] = enhancePixel(data[sourceIdx + 1]); // G
        croppedPixels[targetIdx + 2] = enhancePixel(data[sourceIdx + 2]); // B
        croppedPixels[targetIdx + 3] = data[sourceIdx + 3];           // A
      }
    }
  }
  
  return croppedData;
};

/**
 * Enhances pixel values for better document readability
 */
const enhancePixel = (value: number): number => {
  // Apply contrast enhancement and brightness adjustment
  const contrast = 1.2;
  const brightness = 10;
  return Math.min(255, Math.max(0, (value - 128) * contrast + 128 + brightness));
};

/**
 * Preprocesses document image using Python microservice
 * Automatically detects document edges and crops them using Pillow and OpenCV
 */
export const preprocessDocumentImage = async (file: File, enhance: boolean = true): Promise<File> => {
  try {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('enhance', enhance.toString());

    const response = await fetch('/api/process-document-image', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      console.warn('Document preprocessing failed, using original image');
      return file;
    }

    const result: DocumentProcessingResult = await response.json();

    if (result.processed && result.processed_image) {
      // Converti base64 in File
      const base64Data = result.processed_image;
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/jpeg' });
      
      return new File([blob], `processed_${file.name}`, { type: 'image/jpeg' });
    } else {
      if (result.warning) {
        console.warn('Document preprocessing warning:', result.warning);
      }
      return file;
    }
  } catch (error) {
    console.error('Document preprocessing error:', error);
    return file; // Fallback to original file
  }
};

/**
 * Uploads processed image to Google Cloud Storage via Firebase
 * Now includes automatic document preprocessing
 */
export const uploadImageToCloud = async (file: File, enablePreprocessing: boolean = true): Promise<string> => {
  // Importa Firebase Storage dedicato alle immagini dinamicamente per evitare errori SSR
  const { imageStorage } = await import('@/lib/firebase');
  const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
  
  try {
    // Applica preprocessing automatico se abilitato
    let fileToUpload = file;
    if (enablePreprocessing) {
      console.log('🔄 Preprocessing document image...');
      fileToUpload = await preprocessDocumentImage(file, true);
    }
    
    // Genera un nome file unico con timestamp
    const timestamp = Date.now();
    const fileName = `documents/${timestamp}_${fileToUpload.name}`;
    
    // Crea un riferimento al file in Firebase Storage dedicato alle immagini
    const storageRef = ref(imageStorage, fileName);
    
    // Carica il file
    console.log('📤 Uploading to Google Cloud Storage...');
    const snapshot = await uploadBytes(storageRef, fileToUpload);
    
    // Ottieni l'URL di download
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    console.log('✅ Image uploaded successfully to Google Cloud Storage:', downloadURL);
    return downloadURL;
    
  } catch (error) {
    console.error('Google Cloud Storage upload error:', error);
    // Fallback: return a local blob URL if cloud upload fails
    console.warn('⚠️ Using fallback local URL');
    return URL.createObjectURL(file);
  }
};

/**
 * Converts a blob URL to a File object
 */
export const blobUrlToFile = async (blobUrl: string, fileName: string): Promise<File> => {
  const response = await fetch(blobUrl);
  const blob = await response.blob();
  return new File([blob], fileName, { type: blob.type });
}; 