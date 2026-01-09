import { supabase } from './supabase';

export const STORAGE_BUCKET = 'installer-documents';

/**
 * Upload a file to Supabase Storage
 * @param file - The file to upload
 * @param userId - The user's ID
 * @param documentType - Type of document being uploaded
 * @param version - Version number for the document
 * @returns The file path in storage
 */
export async function uploadDocument(
  file: File,
  userId: string,
  documentType: string,
  version: number = 1
): Promise<string> {
  try {
    // Create a unique file path with versioning
    const fileExt = file.name.split('.').pop();
    const fileName = `${documentType}_v${version}.${fileExt}`;
    const filePath = `${userId}/${documentType}/${fileName}`;

    // Upload file to Supabase Storage
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true, // Allow overwriting if exists
      });

    if (error) {
      console.error('Storage upload error:', error);
      throw new Error(`Failed to upload ${documentType}: ${error.message}`);
    }

    return data.path;
  } catch (error) {
    console.error('Upload document error:', error);
    throw error;
  }
}

/**
 * Get the next version number for a document type
 * @param userId - The user's ID
 * @param documentType - Type of document
 * @returns The next version number
 */
export async function getNextDocumentVersion(
  userId: string,
  documentType: string
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('installer_documents')
      .select('version')
      .eq('user_id', userId)
      .eq('document_type', documentType)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error getting version:', error);
      return 1;
    }

    return data ? data.version + 1 : 1;
  } catch (error) {
    console.error('Get version error:', error);
    return 1;
  }
}

/**
 * Save document metadata to the database
 */
export async function saveDocumentMetadata(
  userId: string,
  documentType: string,
  fileName: string,
  filePath: string,
  fileSize: number,
  version: number,
  issuedDate?: string,
  expiryDate?: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('installer_documents')
      .insert({
        user_id: userId,
        document_type: documentType,
        file_name: fileName,
        file_path: filePath,
        file_size: fileSize,
        version: version,
        issued_date: issuedDate || null,
        expiry_date: expiryDate || null,
      });

    if (error) {
      console.error('Error saving document metadata:', error);
      throw new Error(`Failed to save document metadata: ${error.message}`);
    }
  } catch (error) {
    console.error('Save metadata error:', error);
    throw error;
  }
}

/**
 * Get public URL for a document
 */
export function getDocumentUrl(filePath: string): string {
  const { data } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(filePath);
  
  return data.publicUrl;
}

/**
 * Delete a document from storage
 */
export async function deleteDocument(filePath: string): Promise<void> {
  try {
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([filePath]);

    if (error) {
      throw new Error(`Failed to delete document: ${error.message}`);
    }
  } catch (error) {
    console.error('Delete document error:', error);
    throw error;
  }
}

