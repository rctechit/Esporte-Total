import { v2 as cloudinary } from "cloudinary";
import { env, cloudinaryEnabled } from "../env.js";

if (cloudinaryEnabled) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

interface SignedUpload {
  timestamp: number;
  signature: string;
  apiKey: string;
  cloudName: string;
  folder: string;
}

/**
 * Gera uma assinatura de upload para o cliente enviar a foto diretamente ao
 * Cloudinary (upload assinado), sem expor a API secret no frontend.
 */
export function createSignedUpload(folder = "esporte-total/unidades"): SignedUpload {
  if (!cloudinaryEnabled) {
    throw new Error("Cloudinary não está configurado neste ambiente.");
  }

  const timestamp = Math.round(Date.now() / 1000);
  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder },
    env.CLOUDINARY_API_SECRET
  );

  return {
    timestamp,
    signature,
    apiKey: env.CLOUDINARY_API_KEY,
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    folder,
  };
}

export async function destroyImage(publicId: string): Promise<void> {
  if (!cloudinaryEnabled) return;
  await cloudinary.uploader.destroy(publicId);
}
