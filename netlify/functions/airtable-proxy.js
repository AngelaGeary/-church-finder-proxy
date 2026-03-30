/**
 * Netlify Function: Airtable Proxy
 * 
 * Proxies requests to the Airtable API so the API key never reaches the browser.
 * 
 * SETUP:
 * 1. In your Netlify dashboard, go to Site Settings → Environment Variables
 * 2. Add: AIRTABLE_API_KEY = your Bearer token (e.g. patW0bX9TbPy...)
 * 3. Deploy — the function will be available at /.netlify/functions/airtable-proxy
 */

const AIRTABLE_BASE = 'appSE6JqFAzvuFCoP';
const AIRTABLE_TABLE = 'tblV0nmymzsxZmfsF';
const AIRTABLE_API_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}`;

// Allowed origins — update with your actual domain(s)
const ALLOWED_ORIGINS = [
    'https://www.evangelical-times.org',  // ← CHANGE THIS to your Ghost domain
    'http://localhost:2368',         // Ghost local dev
];

exports.handler = async function (event) {
    const origin = event.headers.origin || event.headers.Origin || '';
    const isAllowed = ALLOWED_ORIGINS.some(o => origin.startsWith(o));

    // CORS headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
    };

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: corsHeaders, body: '' };
    }

    // Only allow GET
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }

    // Read the API key from environment variable
    const apiKey = process.env.AIRTABLE_API_KEY;
    if (!apiKey) {
        console.error('AIRTABLE_API_KEY environment variable is not set');
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Server configuration error' }),
        };
    }

    try {
        // Forward the offset parameter if present (for pagination)
        const offset = event.queryStringParameters?.offset;
        const url = offset
            ? `${AIRTABLE_API_URL}?offset=${encodeURIComponent(offset)}`
            : AIRTABLE_API_URL;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Airtable API error:', response.status, errorText);
            return {
                statusCode: response.status,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Upstream API error' }),
            };
        }

        const data = await response.json();

        return {
            statusCode: 200,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                // Cache for 5 minutes — church data doesn't change frequently
                'Cache-Control': 'public, max-age=300, s-maxage=300',
            },
            body: JSON.stringify(data),
        };
    } catch (error) {
        console.error('Proxy error:', error);
        return {
            statusCode: 502,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Failed to fetch data' }),
        };
    }
};
