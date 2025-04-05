import type { APIRoute } from 'astro';

export const prerender = false;

const OPENWEATHER_API_KEY = import.meta.env.OPENWEATHER_API_KEY || "7681ccd2d2e91bda6e84250eeead0d99";
const DEEPSEEK_API_KEY = import.meta.env.DEEPSEEK_API_KEY || "sk-0c9da655ed2546b289fa27db8ce7f62d";

const envKeys = Object.keys(import.meta.env);
console.log('Environment variables available:', envKeys.map(key =>
  key === 'DEEPSEEK_API_KEY' ? `${key}: [HIDDEN]` : `${key}: ${key === 'OPENWEATHER_API_KEY' ? '[PRESENT/FALLBACK]' : 'Present'}`
).join(', '));

if (!OPENWEATHER_API_KEY) {
  console.error("Missing OpenWeatherMap API Key (OPENWEATHER_API_KEY)");
}
if (!DEEPSEEK_API_KEY) {
  console.error("Missing DeepSeek API Key (DEEPSEEK_API_KEY). AI features will be disabled.");
}

const OPENWEATHER_API_URL = 'https://api.openweathermap.org/data/2.5/forecast';
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

interface WeatherDay {
  date: string;
  avgTemp: number;
  minTemp: number;
  maxTemp: number;
  condition: string;
  description: string;
  humidity: number;
  windSpeed: number;
  cloudCover: number;
  precipitation: number;
}

function groupByDay(weatherList: any[]): WeatherDay[] {
  const days: { [key: string]: any } = {};

  weatherList.forEach(entry => {
    const date = entry.dt_txt.split(' ')[0];
    if (!days[date]) {
      days[date] = { readings: [] };
    }
    days[date].readings.push({
      temp: entry.main.temp,
      temp_min: entry.main.temp_min,
      temp_max: entry.main.temp_max,
      humidity: entry.main.humidity,
      windSpeed: entry.wind.speed,
      condition: entry.weather[0].main,
      description: entry.weather[0].description,
      cloudCover: entry.clouds.all,
      rain: entry.rain ? entry.rain['3h'] || 0 : 0,
      snow: entry.snow ? entry.snow['3h'] || 0 : 0
    });
  });

  return Object.entries(days)
    .filter(([date, data]) => data.readings.length >= 4)
    .map(([date, data]) => {
      const readings = data.readings;
      const temps = readings.map((r: any) => r.temp);
      const tempMins = readings.map((r: any) => r.temp_min);
      const tempMaxs = readings.map((r: any) => r.temp_max);
      const midDayReading = readings[Math.floor(readings.length / 2)];
      const conditionDescription = midDayReading.description;

      const conditions = readings.map((r: any) => r.condition);
      const conditionCounts = conditions.reduce((acc: any, curr: string) => {
        acc[curr] = (acc[curr] || 0) + 1;
        return acc;
      }, {});
      const mainCondition = Object.entries(conditionCounts)
        .sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || 'Unknown';

      return {
        date,
        avgTemp: temps.reduce((a: number, b: number) => a + b, 0) / temps.length,
        minTemp: Math.min(...tempMins),
        maxTemp: Math.max(...tempMaxs),
        condition: mainCondition,
        description: conditionDescription,
        humidity: readings.reduce((a: number, b: any) => a + b.humidity, 0) / readings.length,
        windSpeed: (readings.reduce((a: number, b: any) => a + b.windSpeed, 0) / readings.length) * 3.6,
        cloudCover: readings.reduce((a: number, b: any) => a + b.cloudCover, 0) / readings.length,
        precipitation: readings.reduce((a: number, b: any) => a + (b.rain || 0) + (b.snow || 0), 0)
      };
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function getBestDay(forecast: WeatherDay[], preference: string): WeatherDay | null {
  if (!forecast || forecast.length === 0) return null;

  const weights = forecast.map(day => {
    let score = 0;
    const condition = day.condition.toLowerCase();
    const temp = day.avgTemp;

    score -= forecast.indexOf(day) * 0.1;

    switch (preference.toLowerCase()) {
    case 'sunny':
        score += condition.includes('clear') ? 3 : (condition.includes('clouds') ? -1 : -2);
        score += day.cloudCover < 20 ? 2 : (day.cloudCover < 50 ? 1 : 0);
        score += (temp >= 20 && temp <= 30) ? 1 : 0;
        score -= day.precipitation > 0.5 ? 2 : 0;
      break;
    case 'clear':
        score += condition.includes('clear') ? 3 : (condition.includes('clouds') ? -1 : -2);
        score += day.cloudCover < 15 ? 2 : (day.cloudCover < 40 ? 1 : 0);
        score += (temp >= 15 && temp <= 28) ? 1 : 0;
        score -= day.precipitation > 0.5 ? 2 : 0;
      break;
    case 'cloudy':
        score += condition.includes('clouds') ? 2 : (condition.includes('clear') ? -1 : 0);
        score += (day.cloudCover > 50 && day.cloudCover < 95) ? 2 : 0;
        score += (temp >= 15 && temp <= 25) ? 1 : 0;
        score -= day.precipitation > 1 ? 1 : 0;
      break;
    case 'rainy':
        score += (condition.includes('rain') || condition.includes('drizzle')) ? 3 : -1;
        score += day.precipitation > 1 ? 2 : (day.precipitation > 0 ? 1 : 0);
        score += (temp >= 10 && temp <= 20) ? 1 : 0;
      break;
    case 'warm':
        score += (temp >= 22 && temp <= 30) ? 2 : (temp > 30 ? 1 : 0);
        score += condition.includes('clear') ? 1 : (condition.includes('clouds') ? 0.5 : 0);
        score += day.humidity < 75 ? 1 : 0;
        score -= day.precipitation > 0.5 ? 1 : 0;
      break;
    case 'cool':
        score += (temp >= 10 && temp <= 20) ? 2 : (temp < 10 ? 1 : 0);
        score += (condition.includes('cloud') || condition.includes('clear')) ? 1 : 0;
        score += day.windSpeed < 20 ? 1 : 0;
        score -= day.precipitation > 1 ? 1 : 0;
      break;
    default:
        score += (temp >= 18 && temp <= 26) ? 1 : 0;
        score += (!condition.includes('rain') && !condition.includes('snow') && !condition.includes('storm')) ? 1 : -1;
        score += day.cloudCover < 70 ? 0.5 : 0;
        score += day.windSpeed < 25 ? 0.5 : 0;
    }

    if (preference.toLowerCase() !== 'rainy' && day.precipitation > 5) score -= 2;
    if (day.windSpeed > 35) score -= 1;

    return { day, score };
  });

  const positiveScores = weights.filter(w => w.score >= 0);
  const sortedWeights = (positiveScores.length > 0 ? positiveScores : weights)
                        .sort((a, b) => b.score - a.score);

  return sortedWeights.length > 0 ? sortedWeights[0].day : null;
}

async function getAiWeatherNarrative(
  locationName: string,
  preference: string,
  forecastSummary: WeatherDay[]
): Promise<string | null> {
  if (!DEEPSEEK_API_KEY) {
    console.log("DeepSeek API key not found, skipping AI narrative generation.");
    return null;
  }

  if (!forecastSummary || forecastSummary.length === 0) {
    return "Could not generate AI summary as forecast data is unavailable.";
  }

  const forecastText = forecastSummary.slice(0, 3).map(day =>
    `${new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}: ${day.condition} (${day.description}), avg ${day.avgTemp.toFixed(0)}°C, ${day.precipitation > 0.1 ? `precip ${day.precipitation.toFixed(1)}mm` : 'no precip'}.`
  ).join('\n');

  const prompt = `You are a helpful and creative weather assistant. Based on the following forecast summary for ${locationName}, generate a short (2-3 sentences max), engaging narrative for someone whose weather preference is '${preference}'. Mention the general trend or highlight the best day according to their preference. Suggest one hyper-local, context-aware activity if possible, otherwise a general one suitable for the weather and location. Be concise and friendly.

Forecast Summary:
${forecastText}

Narrative:`;

  try {
    console.log(`Sending prompt to DeepSeek for ${locationName}...`);
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "You are a helpful and creative weather assistant providing short, engaging narratives." },
          { role: "user", content: prompt }
        ],
        max_tokens: 100,
        temperature: 0.7,
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`DeepSeek API error (${response.status}): ${errorBody}`);
      return `Could not generate AI summary due to API error (${response.status}).`;
    }

    const data = await response.json();

    if (data.choices && data.choices.length > 0 && data.choices[0].message) {
      const narrative = data.choices[0].message.content.trim();
      console.log(`DeepSeek response received for ${locationName}.`);
      return narrative;
    } else {
      console.error("DeepSeek API returned unexpected response structure:", data);
      return "Could not generate AI summary due to unexpected API response.";
    }

  } catch (error: any) {
    console.error("Error calling DeepSeek API:", error);
    return `Could not generate AI summary: ${error.message}`;
  }
}

export const GET: APIRoute = async ({ request, url }) => {
  try {
    const params = url.searchParams;
    const lat = params.get('lat');
    const lon = params.get('lon');
    const pref = params.get('pref') || 'preferred';
    const generateNarrativeFlag = params.get('generateNarrative') === 'true';

    if (!lat || !lon) {
      return new Response(JSON.stringify({ error: 'Missing coordinates' }), {
          status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);
    if (isNaN(latNum) || isNaN(lonNum)) {
       return new Response(JSON.stringify({ error: 'Invalid coordinate format' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
      });
    }

    const weatherUrl = `${OPENWEATHER_API_URL}?lat=${latNum}&lon=${lonNum}&units=metric&appid=${OPENWEATHER_API_KEY}`;
    console.log(`Fetching weather from: ${weatherUrl.replace(OPENWEATHER_API_KEY, '[KEY]')}`);

    const weatherResponse = await fetch(weatherUrl);

    if (!weatherResponse.ok) {
      const errorText = await weatherResponse.text();
      console.error(`OpenWeatherMap API error: ${weatherResponse.status} - ${errorText}`);
      throw new Error(`Weather API request failed (${weatherResponse.status})`);
    }

    const weatherData = await weatherResponse.json();

    if (!weatherData || !weatherData.list || !weatherData.city) {
        console.error("Invalid data structure received from OpenWeatherMap:", weatherData);
        throw new Error("Received invalid data from weather provider.");
    }

    const forecast = groupByDay(weatherData.list);
    const bestDay = getBestDay(forecast, pref);
    const locationName = weatherData.city?.name || 'Unknown Location';

    const month = new Date().getMonth();
    const hemisphere = latNum >= 0 ? 'northern' : 'southern';
    let season: string;

    if (hemisphere === 'northern') {
        if (month >= 2 && month <= 4) season = 'Spring';
        else if (month >= 5 && month <= 7) season = 'Summer';
        else if (month >= 8 && month <= 10) season = 'Autumn';
        else season = 'Winter';
    } else {
        if (month >= 8 && month <= 10) season = 'Spring';
        else if (month >= 11 || month <= 1) season = 'Summer';
        else if (month >= 2 && month <= 4) season = 'Autumn';
        else season = 'Winter';
    }

    const seasonalTemp = {
        'Winter': 5,
        'Spring': 15,
        'Summer': 25,
        'Autumn': 15
    }[season] || 15;

    let aiNarrative: string | null = null;
    if (generateNarrativeFlag) {
      console.log(`Narrative generation requested for ${locationName}. Calling DeepSeek...`);
      aiNarrative = await getAiWeatherNarrative(locationName, pref, forecast);
    } else {
        console.log(`Narrative generation not requested for ${locationName}. Skipping DeepSeek call.`);
    }

    const responsePayload = {
      forecast,
      recommendation: {
        bestDay,
        ...(generateNarrativeFlag && { aiNarrative })
      },
      location: {
        lat: latNum,
        lon: lonNum,
        name: locationName
      },
      seasonalAverage: {
        season: season,
        temp: seasonalTemp
      }
    };

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
       }
    });

  } catch (error: any) {
    console.error('API Route Error:', error);
    return new Response(JSON.stringify({
        error: 'An error occurred while fetching weather data.' ,
        details: error.message
    }), {
        status: 500,
      headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
    });
  }
};