import { supabase } from './supabase';
import { compressForUpload } from './compressUpload';
import type { DocumentBankCategory } from '../types';
import type { DocumentAppliesTo } from './documentProductLinks';

export async function uploadToDocumentBank(params: {
  file: File;
  category: DocumentBankCategory;
  name?: string;
  description?: string;
  productType?: DocumentAppliesTo | null;
}): Promise<{ id: string; name: string; category: DocumentBankCategory }> {
  const { file, category, name, description, productType } = params;

  const { file: uploadFile } = await compressForUpload(file);

  if (uploadFile.size > 10 * 1024 * 1024) {
    throw new Error('File size must be less than 10MB after compression');
  }

  const fileExt = uploadFile.name.split('.').pop();
  const storageName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `documents/${category}/${storageName}`;

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(filePath, uploadFile);

  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from('documents').getPublicUrl(filePath);

  const displayName = (name || file.name.replace(/\.[^.]+$/, '') || file.name).trim();

  const { data, error: dbError } = await supabase
    .from('documents')
    .insert({
      name: displayName,
      description: description || null,
      category,
      product_type: productType || null,
      file_url: publicUrl,
      file_name: uploadFile.name,
      file_size: uploadFile.size,
      mime_type: uploadFile.type || file.type,
    })
    .select('id, name, category')
    .single();

  if (dbError) throw dbError;
  if (!data) throw new Error('Upload succeeded but document record was not created');

  return {
    id: data.id,
    name: data.name,
    category: data.category as DocumentBankCategory,
  };
}
