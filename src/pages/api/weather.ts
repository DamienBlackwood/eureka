import type { APIRoute } from 'astro';

// Ensure this API endpoint is server-rendered
export const prerender = false;

// Log environment variables (safely)
const envKeys = Object.keys(import.meta.env);
console.log('Environment variables available:', envKeys.map(key => 
  key.includes('KEY') ? `${key}: [HIDDEN]` : key
).join(', '));

/**
 * Generate weather data based on preference
 */
function generateWeatherData(lat: number, lon: number, pref: string | null) {
  // Ensure we have a preference, defaulting to clear
  const preference = (pref || 'clear').toLowerCase();
  
  // Calculate a "season" based on date to provide more realistic data
  const now = new Date();
  const month = now.getMonth(); // 0-11
  
  // Determine season (Northern Hemisphere)
  let season = 'spring';
  let baseTemp = 15; // Default base temperature °C
  
  if (month >= 11 || month <= 1) { // Dec-Feb
    season = 'winter';
    baseTemp = 2;
  } else if (month >= 2 && month <= 4) { // Mar-May
    season = 'spring';
    baseTemp = 12;
  } else if (month >= 5 && month <= 7) { // Jun-Aug
    season = 'summer';
    baseTemp = 25;
  } else { // Sep-Nov
    season = 'autumn';
    baseTemp = 15;
  }
  
  // Location name based on coordinates
  // In a real app, this would use reverse geocoding
  const locationName = "Oakville"; // Default
  
  // Generate weather patterns based on preference
  let conditions: string[];
  let temperatures: number[];
  let cloudCover: number[];
  let precipitation: number[];
  
  switch (preference) {
    case 'sunny':
      conditions = ['Clear', 'Clear', 'Clear', 'Partly Cloudy', 'Clear'];
      temperatures = [baseTemp + 5, baseTemp + 4, baseTemp + 6, baseTemp + 3, baseTemp + 7];
      cloudCover = [5, 10, 0, 25, 5];
      precipitation = [0, 0, 0, 0, 0];
      break;
      
    case 'clear':
      conditions = ['Clear', 'Clear', 'Partly Cloudy', 'Clear', 'Clear'];
      temperatures = [baseTemp + 2, baseTemp + 4, baseTemp + 1, baseTemp + 5, baseTemp + 3];
      cloudCover = [5, 10, 20, 5, 0];
      precipitation = [0, 0, 0, 0, 0];
      break;
      
    case 'cloudy':
      conditions = ['Cloudy', 'Partly Cloudy', 'Cloudy', 'Overcast', 'Partly Cloudy'];
      temperatures = [baseTemp, baseTemp - 1, baseTemp - 2, baseTemp - 1, baseTemp];
      cloudCover = [75, 50, 80, 90, 60];
      precipitation = [0, 0, 0.1, 0.2, 0];
      break;
      
    case 'rainy':
      conditions = ['Rain', 'Light Rain', 'Rain', 'Showers', 'Light Rain'];
      temperatures = [baseTemp - 2, baseTemp - 3, baseTemp - 1, baseTemp - 2, baseTemp];
      cloudCover = [90, 80, 95, 85, 75];
      precipitation = [2.5, 1.0, 3.0, 1.5, 0.5];
      break;
      
    case 'warm':
      conditions = ['Clear', 'Partly Cloudy', 'Clear', 'Sunny', 'Clear'];
      temperatures = [baseTemp + 8, baseTemp + 7, baseTemp + 10, baseTemp + 9, baseTemp + 6];
      cloudCover = [10, 30, 5, 0, 20];
      precipitation = [0, 0, 0, 0, 0];
      break;
      
    case 'cool':
      conditions = ['Partly Cloudy', 'Clear', 'Cloudy', 'Clear', 'Partly Cloudy'];
      temperatures = [baseTemp - 5, baseTemp - 6, baseTemp - 4, baseTemp - 7, baseTemp - 5];
      cloudCover = [30, 10, 60, 15, 40];
      precipitation = [0, 0, 0.1, 0, 0];
      break;
      
    default:
      // Default mixed weather
      conditions = ['Clear', 'Partly Cloudy', 'Cloudy', 'Clear', 'Light Rain'];
      temperatures = [baseTemp, baseTemp + 2, baseTemp - 1, baseTemp + 1, baseTemp - 2];
      cloudCover = [10, 40, 70, 15, 80];
      precipitation = [0, 0, 0, 0, 0.5];
  }
  
  // Generate forecast for 5 days
  const forecast = [];
  for (let i = 0; i < 5; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    
    // Add some randomization for realism
    const tempVariation = Math.random() * 2 - 1; // -1 to +1
    const cloudVariation = Math.floor(Math.random() * 10) - 5; // -5 to +5
    
    const avgTemp = temperatures[i] + tempVariation;
    const minTemp = avgTemp - (2 + Math.random() * 2); // 2-4 degrees below avg
    const maxTemp = avgTemp + (2 + Math.random() * 2); // 2-4 degrees above avg
    
    forecast.push({
      date: date.toISOString().split('T')[0],
      avgTemp,
      minTemp,
      maxTemp,
      condition: conditions[i],
      cloudCover: Math.max(0, Math.min(100, cloudCover[i] + cloudVariation)),
      precipitation: precipitation[i],
      description: `${conditions[i]} conditions`
    });
  }
  
  // Find the best day for the preference
  // In a real app, this would use more sophisticated logic
  let bestDayIndex = 0;
  
  // Simple logic - best day is where conditions match preference most closely
  if (preference === 'sunny' || preference === 'clear') {
    // Find the day with lowest cloud cover
    let lowestCloud = cloudCover[0];
    for (let i = 1; i < cloudCover.length; i++) {
      if (cloudCover[i] < lowestCloud) {
        lowestCloud = cloudCover[i];
        bestDayIndex = i;
      }
    }
  } else if (preference === 'cloudy') {
    // Find the day with highest cloud cover but no rain
    let highestCloud = 0;
    for (let i = 0; i < cloudCover.length; i++) {
      if (cloudCover[i] > highestCloud && precipitation[i] < 0.5) {
        highestCloud = cloudCover[i];
        bestDayIndex = i;
      }
    }
  } else if (preference === 'rainy') {
    // Find the day with highest precipitation
    let highestRain = 0;
    for (let i = 0; i < precipitation.length; i++) {
      if (precipitation[i] > highestRain) {
        highestRain = precipitation[i];
        bestDayIndex = i;
      }
    }
  } else if (preference === 'warm') {
    // Find the warmest day
    let highestTemp = temperatures[0];
    for (let i = 1; i < temperatures.length; i++) {
      if (temperatures[i] > highestTemp) {
        highestTemp = temperatures[i];
        bestDayIndex = i;
      }
    }
  } else if (preference === 'cool') {
    // Find the coolest day
    let lowestTemp = temperatures[0];
    for (let i = 1; i < temperatures.length; i++) {
      if (temperatures[i] < lowestTemp) {
        lowestTemp = temperatures[i];
        bestDayIndex = i;
      }
    }
  }
  
  return {
    location: {
      name: locationName,
      region: "Ontario",
      country: "Canada",
      lat: lat,
      lon: lon
    },
    seasonalAverage: {
      temp: baseTemp,
      season: `${season} conditions`
    },
    recommendation: {
      bestDay: {
        date: forecast[bestDayIndex].date,
        avgTemp: forecast[bestDayIndex].avgTemp,
        condition: forecast[bestDayIndex].condition
      }
    },
    forecast: forecast
  };
}

export const GET: APIRoute = async ({ request }) => {
  try {
    // Parse URL and parameters
    const url = new URL(request.url);
    
    // Extract parameters from URL, handling potential issues with searchParams
    let lat = url.searchParams.get('lat');
    let lon = url.searchParams.get('lon');
    let pref = url.searchParams.get('pref');
    
    console.log(`Weather API request received - URL: ${request.url}`);
    
    // If parameters are missing from searchParams, try to extract from URL string directly
    if (!lat || !lon) {
      console.log("Parameters missing from searchParams, attempting manual extraction");
      
      // Manual parameter extraction from URL string as fallback
      const urlString = request.url;
      const queryString = urlString.split('?')[1];
      
      if (queryString) {
        const params = new URLSearchParams(queryString);
        lat = lat || params.get('lat');
        lon = lon || params.get('lon');
        pref = pref || params.get('pref');
        
        console.log(`Manual parameter extraction: lat=${lat}, lon=${lon}, pref=${pref}`);
      }
    }
    
    console.log(`Final parameters: lat=${lat}, lon=${lon}, pref=${pref}`);

    // Validate presence of coordinates
    if (!lat || !lon) {
      console.error("Missing coordinates: lat or lon is null or empty");
      return new Response(
        JSON.stringify({ 
          error: "Latitude and Longitude are required",
          receivedParams: { lat, lon, pref },
          url: request.url,
          requestInfo: {
            method: request.method,
            headers: Object.fromEntries([...request.headers.entries()]),
            urlString: request.url
          },
          env: envKeys.length > 0 ? "Environment variables present" : "No environment variables"
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*" // Allow any origin to access
          },
        }
      );
    }

    // Validate numeric values
    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);
    
    if (isNaN(latNum) || isNaN(lonNum)) {
      console.error(`Invalid coordinates format: lat=${lat}, lon=${lon}`);
      return new Response(
        JSON.stringify({ 
          error: "Coordinates must be valid numbers",
          receivedParams: { lat, lon, pref }
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json"
          },
        }
      );
    }
    
    // Validate coordinate ranges
    if (latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) {
      console.error(`Coordinates out of range: lat=${latNum}, lon=${lonNum}`);
      return new Response(
        JSON.stringify({ 
          error: "Coordinates out of valid range",
          receivedParams: { lat: latNum, lon: lonNum, pref }
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json"
          },
        }
      );
    }

    console.log(`Processing valid coordinates: lat=${latNum}, lon=${lonNum}`);
    
    // Check API key availability for debugging
    const apiKey = import.meta.env.PUBLIC_OPENWEATHERMAP_API_KEY;
    console.log(`API Key available: ${apiKey ? "Yes" : "No"}`);
    
    // Generate mock weather data based on preferences
    const data = generateWeatherData(latNum, lonNum, pref);

    console.log("Sending response with data:", {
      location: data.location,
      recommendation: data.recommendation
    });

    // Respond with the data
    return new Response(
      JSON.stringify(data),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate"
        },
      }
    );
  } catch (error) {
    // Handle any unexpected errors
    console.error("Unexpected error in weather API:", error);
    return new Response(
      JSON.stringify({ 
        error: "Failed to generate weather data",
        message: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        },
      }
    );
  }
}; 