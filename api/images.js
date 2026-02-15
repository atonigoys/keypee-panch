// Vercel Serverless Function: Proxy Cloudinary Admin API
// This runs server-side, bypassing CORS and hiding API credentials.

export default async function handler(req, res) {
    const CLOUD_NAME = "dabwa174p";
    const API_KEY = "791274659166275";
    const API_SECRET = "KqoMlHuFEr0dYTVEaw92ccY4mVM";

    const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/image?max_results=100&context=true&tags=true&direction=desc&type=upload`;

    try {
        const authHeader = 'Basic ' + Buffer.from(API_KEY + ':' + API_SECRET).toString('base64');

        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': authHeader }
        });

        if (!response.ok) {
            const errorData = await response.json();
            return res.status(response.status).json({ error: errorData });
        }

        const data = await response.json();

        // Set cache headers (short cache to stay fresh)
        res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=10');
        return res.status(200).json(data);

    } catch (error) {
        console.error('Cloudinary API error:', error);
        return res.status(500).json({ error: 'Failed to fetch from Cloudinary' });
    }
}
