import { TransactionalEmailsApi, TransactionalEmailsApiApiKeys } from '@getbrevo/brevo';
import { BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME } from '../../config/index.js';

export const brevoTransacApi = new TransactionalEmailsApi();
// Configure API key using official SDK method
brevoTransacApi.setApiKey(TransactionalEmailsApiApiKeys.apiKey, BREVO_API_KEY);

export const brevoSender = {
  email: BREVO_SENDER_EMAIL,
  name: BREVO_SENDER_NAME,
};