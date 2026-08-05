const API_URL =
    import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

export interface HealthResponse {
    status: string;
    application: string;
    timestamp: string;
}

export async function getApiHealth(): Promise<HealthResponse> {
    const response = await fetch(`${API_URL}/health`);

    if (!response.ok) {
        throw new Error(`Falha ao acessar a API: ${response.status}`);
    }

    return response.json() as Promise<HealthResponse>;
}