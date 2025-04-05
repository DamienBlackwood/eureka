const TRAIL_API_URL = 'https://www.trailapi.com/v1/trails/explore/';

interface Trail {
  name: string;
  location: string;
  difficulty: string;
  latitude: number;
  longitude: number;
  description?: string;
  length?: number;
  mapLink?: string;
}

export async function GET({ url }: { url: URL }) {
  try {
    const params = new URL(url).searchParams;
    const lat = params.get('lat');
    const lon = params.get('lon');
    const radius = params.get('radius') || '5000';

    if (!lat || !lon) {
      return new Response(JSON.stringify({ error: 'Missing coordinates' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const mockTrails: Trail[] = [
      {
        name: "Taplow Creek Trail",
        location: "1903 Pilgrim Way",
        difficulty: "Easy",
        latitude: parseFloat(lat) + 0.01,
        longitude: parseFloat(lon) + 0.01,
        description: "A beautiful forest loop with scenic views",
        length: 1.2,
        mapLink: "https://maps.app.goo.gl/WwcspjEs9PHd4jAb8?g_st=com.google.maps.preview.copy"
      },
      {
        name: "West Oak Trails",
        location: "2233 Mariposa Road",
        difficulty: "Moderate",
        latitude: parseFloat(lat) - 0.01,
        longitude: parseFloat(lon) - 0.01,
        description: "Follow the river through natural terrain",
        length: 4.0,
        mapLink: "https://maps.app.goo.gl/t2aF8oki2sgoyDe47?g_st=com.google.maps.preview.copy"
      },
      {
        name: "Glenn Abbey Trail",
        location: "2276 Barrister Pl",
        difficulty: "Hard",
        latitude: parseFloat(lat) + 0.02,
        longitude: parseFloat(lon) - 0.02,
        description: "Challenging trail with great views",
        length: 6.5,
        mapLink: "https://maps.app.goo.gl/1Jgb97YmFmYyx4kD9?g_st=com.google.maps.preview.copy"
      }
    ];

    return new Response(JSON.stringify({
      trails: mockTrails,
      meta: {
        count: mockTrails.length,
        radius: parseInt(radius)
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}