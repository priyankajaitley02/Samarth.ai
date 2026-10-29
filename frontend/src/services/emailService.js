import api from './api';

/**
 * Sends a report via email using Nodemailer
 * 
 * @param {string} recipientEmail - The email address to send the report to
 * @param {Buffer|Blob} pdfBuffer - PDF report as buffer or blob
 * @param {string} reportType - Type of report (e.g., 'Assessment', 'AI Analysis')
 * @param {string} patientName - Name of the patient for the report
 * @returns {Promise<Object>} - Response from the email API
 */
export const sendReportByEmail = async (recipientEmail, pdfBuffer, reportType = 'Assessment', patientName = 'Patient') => {
  try {
    // Convert Blob to ArrayBuffer if needed
    let buffer = pdfBuffer;
    if (pdfBuffer instanceof Blob) {
      buffer = await pdfBuffer.arrayBuffer();
    }
    
    // Convert ArrayBuffer to base64 string for sending
    const base64Data = arrayBufferToBase64(buffer);
    
    const response = await api.post('/email/send-report', {
      recipientEmail,
      pdfData: base64Data,
      reportType,
      patientName
    });
    
    return response.data;
  } catch (error) {
    console.error('Error sending report email:', error);
    throw new Error(error.response?.data?.message || 'Failed to send email. Please try again.');
  }
};

/**
 * Helper function to convert ArrayBuffer to Base64 string
 */
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  
  return window.btoa(binary);
}