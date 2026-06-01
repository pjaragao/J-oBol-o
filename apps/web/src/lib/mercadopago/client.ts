import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';

if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
    console.warn('[MercadoPago] ACCESS_TOKEN not configured');
}

const client = new MercadoPagoConfig({
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || '',
});

export const preferenceClient = new Preference(client);
export const paymentClient = new Payment(client);
export { client as mercadoPagoClient };
