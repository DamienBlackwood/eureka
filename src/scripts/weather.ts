
		import L from 'leaflet';

		// --- DOM Elements ---
		const heroBanner = document.getElementById('hero-banner')!;
		const startButton = document.getElementById('start-button')!;
		const weatherContent = document.getElementById('weather-content')!;
		const mapElement = document.getElementById('map')!;
		const questionnaire = document.getElementById('questionnaire')!;
		const preferenceButtons = questionnaire.querySelectorAll('.options button');
		const resultsDiv = document.getElementById('results')!;

		let map: L.Map | null = null;
		let marker: L.Marker | null = null; // Keep track of the marker
		let userCoords: { lat: number; lon: number } | null = null;
		const apiKey = import.meta.env.PUBLIC_OPENWEATHERMAP_API_KEY;

		// --- Initial State ---
		weatherContent.style.display = 'none';
		resultsDiv.style.display = 'none';

		// --- Helper Functions ---
		function fadeOutElement(element: HTMLElement, duration = 500) {
			element.classList.add('fade-out');
			setTimeout(() => {
				element.style.display = 'none';
				element.classList.remove('fade-out'); // Reset for potential reuse
			}, duration);
		}

		function fadeInElement(element: HTMLElement, display = 'block', duration = 500) {
			element.style.opacity = '0'; // Start transparent
			element.style.display = display;
			// Force reflow if needed, though usually not necessary for display change
			// element.offsetHeight;
			element.classList.add('fade-in');
			// No timeout needed to remove class if using `animation-fill-mode: forwards` in CSS
		}

		function getUserLocation(): Promise<{ lat: number; lon: number }> {
			return new Promise((resolve, reject) => {
				if (!navigator.geolocation) {
					reject('Geolocation is not supported by your browser.');
				} else {
					navigator.geolocation.getCurrentPosition(
						(position) => {
							resolve({
								lat: position.coords.latitude,
								lon: position.coords.longitude,
							});
						},
						() => {
							reject('Unable to retrieve your location. Please grant permission.');
							// TODO: Ask user for location manually
						}
					);
				}
			});
		}

		function initializeMap(lat: number, lon: number) {
			if (map) { // If map exists, just update view and marker
				map.setView([lat, lon], 13);
				if (marker) {
					marker.setLatLng([lat, lon])
						.bindPopup('Your updated location.')
						.openPopup();
				} else { // If map exists but marker doesn't (shouldn't happen often)
					marker = L.marker([lat, lon]).addTo(map)
						.bindPopup('Your approximate location.')
						.openPopup();
				}
				return;
			}
			// Initialize map if it doesn't exist
			map = L.map(mapElement).setView([lat, lon], 13);
			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				maxZoom: 19,
				attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
			}).addTo(map);
			// Create and store the marker
			marker = L.marker([lat, lon]).addTo(map)
				.bindPopup('Your approximate location.')
				.openPopup();
		}

		// --- Fetch Weather Data (Using 5-day/3-hour forecast - Free Tier Compatible) ---
		// Store forecast data globally within the script scope
		let currentForecastList: ForecastInterval[] | null = null;
		let currentDailySummaries: DailySummary[] | null = null;
		let userLocationName = ""; // Store the user's location name

		// Function to get location name from coordinates
		async function getLocationName(lat: number, lon: number) {
			try {
				// Use OpenStreetMap's Nominatim for reverse geocoding (free and doesn't require API key)
				const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`;
				console.log("Fetching location name from:", url);
				
				const response = await fetch(url, {
					headers: {
						// Add a user agent as required by Nominatim's usage policy
						'User-Agent': 'WeatherExplorer/1.0'
					}
				});
				
				if (!response.ok) {
					throw new Error("Failed to fetch location data");
				}
				
				const data = await response.json();
				console.log("Location data:", data);
				
				// Extract the location name (city/town if available, otherwise county/state)
				let locationName = "";
				if (data.address) {
					locationName = data.address.city || data.address.town || data.address.village || 
								   data.address.county || data.address.state || "Unknown Location";
				}
				
				// Update the heading with the location name
				const locationHeading = document.querySelector('#weather-content h2');
				if (locationHeading && locationName) {
					userLocationName = locationName;
					locationHeading.textContent = `Weather in ${locationName}`;
				}
				
				return locationName;
			} catch (error) {
				console.error("Error getting location name:", error);
				return null;
			}
		}

		async function fetchWeatherData(lat: number, lon: number) {
			if (!apiKey) {
				console.error("OpenWeatherMap API key is missing. Add PUBLIC_OPENWEATHERMAP_API_KEY to your .env file.");
				resultsDiv.innerHTML = `<p>Error: Weather API key not configured.</p>`; // Use innerHTML
				fadeInElement(resultsDiv);
				return null;
			}
			// Use the 5-day/3-hour forecast endpoint (Free tier compatible)
			const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
			console.log(`Fetching weather data from: ${url}`); // Log URL

			try {
				const response = await fetch(url);
				console.log(`Response status: ${response.status}`); // Log status
				if (!response.ok) {
					const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response' }));
					console.error("API Error Data:", errorData);
					throw new Error(`API error! status: ${response.status} - ${errorData.message || 'Unknown error'}`);
				}
				const data = await response.json();
				console.log("Weather Data Received:", data); // Log the full response
				if (!data || !data.list || data.list.length === 0) {
					throw new Error("Weather data list is empty or missing in the response.");
				}
				currentForecastList = data.list; // Store the raw forecast list
				return currentForecastList; // Return array of 3-hour forecast intervals
			} catch (error) {
				console.error("Error fetching or processing weather data:", error);
				resultsDiv.innerHTML = `<p>Error fetching weather data: ${error instanceof Error ? error.message : String(error)}</p>`; // Use innerHTML
				fadeInElement(resultsDiv);
				return null;
			}
		}

		// --- AI-like Response Generation (Keep as is for now) ---
		const responses = {
			sunny: [
				"Looks like {day} will be gloriously sunny! Perfect for that walk you were thinking about.",
				"Sunshine alert! {day} is your best bet for soaking up some rays.",
				"Get your sunglasses ready! {day} promises plenty of sunshine."
			],
			clear: [
				"A beautiful clear sky is expected on {day}. Enjoy the crisp air!",
				"Stargazing? {day} looks perfect with clear skies predicted.",
				"{day} is shaping up to be wonderfully clear."
			],
			cloudy: [
				"Expect some cloud cover on {day}, cozy vibes incoming!",
				"A bit cloudy on {day}, but still a great day for indoor activities.",
				"{day} will have some clouds rolling in."
			],
			rainy: [
				"Looks like {day} might bring some rain. Perfect for a movie marathon!",
				"Pack an umbrella! Rain is forecasted for {day}.",
				"A rainy {day} is on the horizon. Stay dry!"
			],
			warm: [
				"Things are heating up! {day} looks like the warmest day coming up.",
				"Enjoy the warmth on {day}! Ideal for outdoor fun.",
				"{day} is predicted to be pleasantly warm."
			],
			cool: [
				"A refreshing cool down is expected on {day}.",
				"Enjoy the crisp, cool air on {day}.",
				"{day} looks like the coolest day of the week."
			],
			noMatch: [
				"Hm, couldn't find a perfect day for '{preference}' in the next few days based on the forecast, but {bestDay} looks like the most suitable option available!",
				"While a truly '{preference}' day isn't showing up soon, {bestDay} seems like the closest match.",
				"The forecast doesn't have an ideal '{preference}' day, but {bestDay} is looking pretty good otherwise!"
			],
			error: [
				"Oops, had a little trouble reading the weather tea leaves. Please try again later.",
				"The weather spirits are cloudy right now. Couldn't get a clear forecast.",
				"Something went wrong while checking the weather. Maybe check your API key or try again?"
			]
		};

		function getRandomResponse(type: keyof typeof responses | 'noMatch' | 'error', replacements: Record<string, string> = {}): string {
			// Ensure type exists, default to 'error' if not
			const safeType = responses[type] ? type : 'error';
			const options = responses[safeType];
			if (!options || options.length === 0) return "Something went wrong generating a response."; // Safety net
			let chosenResponse = options[Math.floor(Math.random() * options.length)];
			// Replace placeholders
			for (const key in replacements) {
				chosenResponse = chosenResponse.replace(new RegExp(`{${key}}`, 'g'), replacements[key]);
			}
			return chosenResponse;
		}

		// --- Weather Analysis (Updated for 3-hour forecast list) ---
		interface ForecastInterval {
			dt: number;
			main: { temp: number; feels_like: number; temp_min: number; temp_max: number; pressure: number; sea_level: number; grnd_level: number; humidity: number; temp_kf: number; };
			weather: { id: number; main: string; description: string; icon: string; }[];
			clouds: { all: number; };
			wind: { speed: number; deg: number; gust: number; };
			visibility: number;
			pop: number; // Probability of precipitation
			rain?: { '3h'?: number };
			snow?: { '3h'?: number };
			sys: { pod: string; };
			dt_txt: string;
		}

		interface DailySummary {
			dayName: string;
			date: string;
			temps: number[];
			cloudCover: number[];
			rainAmount: number;
			weatherConditions: string[]; // Store main conditions ('Clear', 'Clouds', 'Rain')
		}

		// --- Add avgTemp, avgCloudCover, dominantWeather to DailySummary ---
		interface ProcessedDailySummary extends DailySummary {
			avgTemp: number;
			avgCloudCover: number;
			dominantWeather: string;
			icon: string; // Add icon code for display
			isToday: boolean; // Flag to indicate if this is today
		}

		function processForecastData(forecastList: ForecastInterval[]): ProcessedDailySummary[] {
			const dailyData: { [key: string]: DailySummary & { icons: string[]; isToday: boolean } } = {}; // Add icons array and isToday flag
			
			// Get today's date for comparison (as YYYY-MM-DD string at midnight local time)
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			const todayString = today.toISOString().split('T')[0];
			
			// Get tomorrow's date for comparison
			const tomorrow = new Date(today);
			tomorrow.setDate(tomorrow.getDate() + 1);
			const tomorrowString = tomorrow.toISOString().split('T')[0];

			forecastList.forEach(interval => {
				const date = new Date(interval.dt * 1000);
				const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD
				
				// Determine if this is today, tomorrow, or another day
				const isToday = dateString === todayString;
				const isTomorrow = dateString === tomorrowString;
				
				// Format the day name properly
				let dayName;
				if (isToday) {
					dayName = "Today";
				} else if (isTomorrow) {
					dayName = "Tomorrow";
				} else {
					// For other days, format as "Mon, Jan 15" instead of just the day name
					dayName = date.toLocaleDateString('en-US', { 
						weekday: 'short',
						month: 'short', 
						day: 'numeric'
					});
				}

				if (!dailyData[dateString]) {
					dailyData[dateString] = {
						dayName: dayName,
						date: dateString,
						temps: [],
						cloudCover: [],
						rainAmount: 0,
						weatherConditions: [],
						icons: [], // Initialize icons array
						isToday: isToday // Flag for "Today"
					};
				}

				dailyData[dateString].temps.push(interval.main.temp);
				dailyData[dateString].cloudCover.push(interval.clouds.all);
				dailyData[dateString].rainAmount += interval.rain?.['3h'] || 0;
				if (interval.weather && interval.weather.length > 0) {
					dailyData[dateString].weatherConditions.push(interval.weather[0].main);
					// Store icon from the ~midday forecast if possible, otherwise first
					if (date.getHours() >= 11 && date.getHours() <= 14 || dailyData[dateString].icons.length === 0) {
						dailyData[dateString].icons.push(interval.weather[0].icon);
					}
				}
			});

			// Convert to array and calculate averages/dominant conditions
			const processedSummaries = Object.values(dailyData).map(day => {
				const avgTemp = day.temps.length > 0 ? day.temps.reduce((a, b) => a + b, 0) / day.temps.length : NaN;
				const avgCloudCover = day.cloudCover.length > 0 ? day.cloudCover.reduce((a, b) => a + b, 0) / day.cloudCover.length : NaN;
				const dominantWeather = getDominantCondition(day.weatherConditions);
				// Select the last added icon (which tries to be midday) or a default
				const icon = day.icons.length > 0 ? day.icons[day.icons.length - 1] : '01d'; // Default to sun icon

				return {
					...day,
					avgTemp,
					avgCloudCover,
					dominantWeather,
					icon,
					isToday: day.isToday
				};
			}).sort((a, b) => a.date.localeCompare(b.date)); // Sort by date

			currentDailySummaries = processedSummaries; // Store processed summaries
			return currentDailySummaries as ProcessedDailySummary[];
		}

		function getDominantCondition(conditions: string[]): string {
			if (!conditions || conditions.length === 0) return 'Unknown';
			const counts: Record<string, number> = {};
			let maxCount = 0;
			let dominant = conditions[0]; // Default to first
			conditions.forEach(condition => {
				counts[condition] = (counts[condition] || 0) + 1;
				if (counts[condition] > maxCount) {
					maxCount = counts[condition];
					dominant = condition;
				}
			});
			// Prioritize significant weather like Rain
			if (conditions.includes('Rain')) return 'Rain';
			if (conditions.includes('Snow')) return 'Snow'; // Add snow if relevant
			if (conditions.includes('Thunderstorm')) return 'Thunderstorm';
			if (conditions.includes('Drizzle')) return 'Drizzle';
			return dominant; // Otherwise return the most frequent
		}

		// --- Modified to return bestDay object and message ---
		function findBestDay(dailySummaries: ProcessedDailySummary[], preference: string): { bestDay: ProcessedDailySummary | null, message: string } {
			console.log("Finding best day for:", preference, "from summaries:", dailySummaries);
			if (!dailySummaries || dailySummaries.length === 0) {
				console.log("No daily summaries to analyze.");
				return { bestDay: null, message: getRandomResponse('error', {reason: 'No forecast data available'}) };
			}

			// Calculate average temperature across all days to determine seasonal context
			const allTemps = dailySummaries.flatMap(day => day.temps).filter(temp => !isNaN(temp));
			const avgSeasonTemp = allTemps.length > 0 
				? allTemps.reduce((sum, temp) => sum + temp, 0) / allTemps.length 
				: 15; // Default to mild if no data
			
			console.log(`Seasonal context - Average temperature: ${avgSeasonTemp.toFixed(1)}°C`);
			
			// Dynamically adjust temperature thresholds based on season
			const isWinterSeason = avgSeasonTemp < 10;
			const isSummerSeason = avgSeasonTemp > 20;
			
			// Adjust thresholds based on seasonal context
			const coolMinTemp = isWinterSeason ? -5 : (isSummerSeason ? 15 : 5);
			const coolMaxTemp = isWinterSeason ? 10 : (isSummerSeason ? 20 : 15);
			const warmMinTemp = isWinterSeason ? 10 : (isSummerSeason ? 20 : 18);
			
			console.log(`Season adjusted thresholds - Cool: ${coolMinTemp}°C to ${coolMaxTemp}°C, Warm min: ${warmMinTemp}°C`);

			let bestDayIndex = -1;
			let bestScore = -Infinity;

			dailySummaries.forEach((day, index) => {
				let score = 0;
				const weatherMain = day.dominantWeather.toLowerCase();
				const temp = day.avgTemp;
				const clouds = day.avgCloudCover;
				const rain = day.rainAmount;

				// Skip if data is invalid (e.g., NaN temp)
				if (isNaN(temp) || isNaN(clouds)) {
					console.log(`Skipping Day: ${day.dayName} due to invalid data`);
					return; // Skip this day
				}

				console.log(`Analyzing Day: ${day.dayName} (${day.date}), Temp: ${temp?.toFixed(1)}, Clouds: ${clouds?.toFixed(0)}%, Rain: ${rain?.toFixed(1)}mm, Weather: ${weatherMain}`);

				switch (preference) {
					case 'sunny':
					case 'clear':
						// Sunny score depends on cloud cover and clear conditions
						score = (100 - clouds) * 1.5 + (weatherMain === 'clear' ? 50 : 0);
						if (weatherMain === 'rain' || rain > 0.5) score -= 100; // Penalize rain heavily
						break;
					case 'cloudy':
						// Cloudiness score is directly proportional to cloud cover
						score = clouds * 1.2;
						if (weatherMain === 'rain' || rain > 0.5) score -= 50; // Penalize rain somewhat
						break;
					case 'rainy':
						// Rainy score prioritizes rain conditions and amount
						score = (weatherMain === 'rain' || weatherMain === 'drizzle' || rain > 0.1) ? 50 + rain * 10 : -50;
						break;
					case 'warm':
						// Warm is relative to season
						const idealWarmTemp = isSummerSeason ? 25 : (isWinterSeason ? 15 : 22);
						score = 100 - Math.abs(temp - idealWarmTemp) * 2;
						if (temp < warmMinTemp) score -= 50; // Penalize if below warm threshold
						if (weatherMain === 'rain' || rain > 0.5) score -= 30; // Penalize rain somewhat
						break;
					case 'cool':
						// Cool temperature scoring - adjust ideal based on season
						const idealCoolTemp = isWinterSeason ? 5 : (isSummerSeason ? 18 : 15);
						score = 100 - Math.abs(temp - idealCoolTemp) * 2;
						// Big penalty if outside the cool range for the season
						if (temp < coolMinTemp || temp > coolMaxTemp) score -= 50;
						if (weatherMain === 'rain' || rain > 1) score -= 30; // Light penalty for rain
						break;
					default:
						score = 0; // Should not happen
				}
				console.log(` -> Score: ${score}`);

				if (score > bestScore) {
					bestScore = score;
					bestDayIndex = index;
				}
			});

			if (bestDayIndex !== -1) {
				const bestDay = dailySummaries[bestDayIndex];
				console.log(`Best day chosen: ${bestDay.dayName} (${bestDay.date}) with score ${bestScore}`);

				// --- Use bestDay properties for the check ---
				const weatherMain = bestDay.dominantWeather.toLowerCase();
				const temp = bestDay.avgTemp; 
				const clouds = bestDay.avgCloudCover;
				const rain = bestDay.rainAmount;
				let isGoodMatch = false;

				// More intelligent matching criteria based on seasonal context
				switch (preference) {
					case 'sunny': 
						isGoodMatch = (weatherMain === 'clear' || (weatherMain === 'clouds' && clouds < 30)) && rain < 0.5;
						break;
					case 'clear': 
						isGoodMatch = weatherMain === 'clear' && clouds < 25 && rain < 0.5;
						break;
					case 'cloudy': 
						isGoodMatch = (weatherMain === 'clouds') && clouds > 40 && rain < 0.5;
						break;
					case 'rainy': 
						isGoodMatch = (weatherMain === 'rain' || weatherMain === 'drizzle' || rain > 0.3);
						break;
					case 'warm': 
						// Warm is relative to season
						isGoodMatch = temp > warmMinTemp && (weatherMain !== 'rain' || rain < 1);
						break;
					case 'cool': 
						// Winter-aware cool definition
						isGoodMatch = temp >= coolMinTemp && temp <= coolMaxTemp && (weatherMain !== 'rain' || rain < 1);
						break;
				}
				console.log(`Is good match? ${isGoodMatch}`);

				const replacements = {
					day: bestDay.dayName,
					preference: preference,
					bestDay: bestDay.dayName,
					temp: temp.toFixed(0),
					condition: weatherMain
				};

				// Generate more context-aware messages
				let message: string;
				if (isGoodMatch) {
					message = `In the next 5 days, ${bestDay.dayName} looks best for '${preference}' weather. It's expected to be ${weatherMain} with an average temperature around ${temp.toFixed(0)}°C.`;
					
					// Add seasonal context to message if relevant
					if (preference === 'cool' && isWinterSeason) {
						message = `In the next 5 days, ${bestDay.dayName} looks best for a cool winter day. It's expected to be ${weatherMain} with an average temperature around ${temp.toFixed(0)}°C.`;
					} else if (preference === 'warm' && isWinterSeason) {
						message = `For winter, ${bestDay.dayName} will be relatively warm at around ${temp.toFixed(0)}°C with ${weatherMain} conditions.`;
					}
				} else {
					message = `Hmm, no perfect '${preference}' days coming up. The closest is ${bestDay.dayName}, which should be ${weatherMain} with an average temperature around ${temp.toFixed(0)}°C.`;
					
					// Add seasonal explanation if relevant
					if (preference === 'cool' && isSummerSeason) {
						message = `It's currently quite warm overall (${avgSeasonTemp.toFixed(0)}°C average). The coolest day will be ${bestDay.dayName} at ${temp.toFixed(0)}°C.`;
					} else if (preference === 'warm' && isWinterSeason) {
						message = `It's winter season (${avgSeasonTemp.toFixed(0)}°C average), so the warmest day will be ${bestDay.dayName} at ${temp.toFixed(0)}°C.`;
					}
				}
				return { bestDay, message };
			} else {
				console.log("Could not determine a best day index.");
				return { bestDay: null, message: getRandomResponse('error', {reason: 'Could not analyze forecast'}) };
			}
		}

		// --- Function to display detailed forecast ---
		function displayDetailedForecast(summaries: ProcessedDailySummary[] | null) {
			const detailedForecastDiv = document.getElementById('detailed-forecast');
			if (!detailedForecastDiv || !summaries) return;

			// Calculate overall average and show seasonal context
			const allValidTemps = summaries.flatMap(day => day.temps).filter(temp => !isNaN(temp));
			const avgSeasonTemp = allValidTemps.length > 0 
				? allValidTemps.reduce((sum, temp) => sum + temp, 0) / allValidTemps.length 
				: null;
			
			let seasonalContext = '';
			if (avgSeasonTemp !== null) {
				const season = avgSeasonTemp < 10 ? 'winter' : avgSeasonTemp > 20 ? 'summer' : 'transitional';
				seasonalContext = `<div class="seasonal-context">Current seasonal average: ${avgSeasonTemp.toFixed(1)}°C (${season} conditions)</div>`;
			}
			
			// Add location context if available
			if (userLocationName) {
				seasonalContext = `<div class="seasonal-context">
					<div>Weather forecast for ${userLocationName}</div>
					${avgSeasonTemp !== null ? `<div>Seasonal average: ${avgSeasonTemp.toFixed(1)}°C (${avgSeasonTemp < 10 ? 'winter' : avgSeasonTemp > 20 ? 'summer' : 'transitional'} conditions)</div>` : ''}
				</div>`;
			}

			let forecastHTML = seasonalContext + '<div class="forecast-grid">';
			summaries.slice(0, 5).forEach(day => { // Limit to 5 days
				// Get min/max temp
				const minTemp = Math.min(...day.temps.filter(temp => !isNaN(temp)));
				const maxTemp = Math.max(...day.temps.filter(temp => !isNaN(temp)));
				
				// Weather condition description
				let conditionClass = 'neutral';
				if (['clear', 'sunny'].includes(day.dominantWeather.toLowerCase())) {
					conditionClass = 'favorable';
				} else if (['rain', 'snow', 'thunderstorm'].includes(day.dominantWeather.toLowerCase())) {
					conditionClass = 'unfavorable';
				}
				
				// Temperature assessment
				let tempDescription = '';
				if (day.avgTemp < 5) {
					tempDescription = 'Very cold';
				} else if (day.avgTemp < 12) {
					tempDescription = 'Cold';
				} else if (day.avgTemp < 18) {
					tempDescription = 'Cool';
				} else if (day.avgTemp < 25) {
					tempDescription = 'Mild';
				} else {
					tempDescription = 'Warm';
				}
				
				// Add today class if this is the current day
				const todayClass = day.isToday ? 'today' : '';
				
				forecastHTML += `
					<div class="forecast-day ${todayClass}">
						<div class="day-name">${day.dayName}</div>
						<img src="https://openweathermap.org/img/wn/${day.icon}@2x.png" alt="${day.dominantWeather}" class="weather-icon">
						<div class="temp">${day.avgTemp.toFixed(0)}°C</div>
						<div class="temp-range">H:${maxTemp.toFixed(0)}° L:${minTemp.toFixed(0)}°</div>
						<div class="condition ${conditionClass}">${day.dominantWeather}</div>
						<div class="description">${tempDescription}, ${day.avgCloudCover.toFixed(0)}% cloud cover</div>
						${day.rainAmount > 0 ? `<div class="precipitation">Rain: ${day.rainAmount.toFixed(1)}mm</div>` : ''}
					</div>
				`;
			});
			forecastHTML += '</div>';

			detailedForecastDiv.innerHTML = forecastHTML;
			fadeInElement(detailedForecastDiv);

			// Hide the "Show More Info" button after showing details
			const showMoreButton = document.getElementById('show-more-button');
			if (showMoreButton) {
				showMoreButton.style.display = 'none';
			}
		}

		// --- Event Listeners ---
		startButton.addEventListener('click', async (event) => {
			event.preventDefault(); // Prevent anchor tag default navigation
			console.log("Start button clicked");
			fadeOutElement(heroBanner);

			try {
				userCoords = await getUserLocation();
				console.log("User coordinates:", userCoords);
				
				// Get and display location name
				getLocationName(userCoords.lat, userCoords.lon)
					.then(locationName => {
						console.log("Location detected:", locationName);
					})
					.catch(error => {
						console.error("Error getting location name:", error);
					});
				
				fadeInElement(weatherContent, 'flex'); // Use flex for centering content
				initializeMap(userCoords.lat, userCoords.lon);
				// Clear any previous results when starting over
				resultsDiv.innerHTML = '';
				resultsDiv.style.display = 'none';
				const detailedDiv = document.getElementById('detailed-forecast');
				if (detailedDiv) detailedDiv.innerHTML = '';
			} catch (error) {
				console.error('Error getting location or initializing map:', error);
				// Show error message to user
				weatherContent.innerHTML = `<p style="color: red; text-align: center; padding: 2rem;">Error: ${error}</p>`;
				fadeInElement(weatherContent);
			}
		});

		preferenceButtons.forEach(button => {
			button.addEventListener('click', async (e) => {
				const preference = (e.target as HTMLButtonElement).dataset.preference;
				console.log(`Preference selected: ${preference}`);
				if (!preference || !userCoords) {
					console.log("Missing preference or user coordinates.");
					resultsDiv.innerHTML = "<p>Please select a preference after location is found.</p>";
					fadeInElement(resultsDiv);
					return;
				}

				// Disable buttons and show loading in results area
				preferenceButtons.forEach(btn => (btn as HTMLButtonElement).disabled = true);
				resultsDiv.innerHTML = '<p>Analyzing the skies...</p>'; // Use innerHTML
				resultsDiv.style.opacity = '0'; // Prepare for fade-in
				const detailedDiv = document.getElementById('detailed-forecast'); // Clear detailed view
				if (detailedDiv) detailedDiv.innerHTML = '';
				fadeInElement(resultsDiv);

				// --- Fade out map and questionnaire ---
				fadeOutElement(mapElement);
				fadeOutElement(questionnaire);

				console.log("Fetching weather data for analysis...");
				// Fetch data only if we don't have it or need to refresh (optional)
				// For now, we assume the first fetch is sufficient for the session
				const forecastList = currentForecastList || await fetchWeatherData(userCoords.lat, userCoords.lon);

				if (forecastList && forecastList.length > 0) {
					console.log("Processing forecast data...");
					// Process data only if not already processed
					const dailySummaries = currentDailySummaries || processForecastData(forecastList);

					if(dailySummaries && dailySummaries.length > 0){
						console.log("Finding best day...");
						const { bestDay, message } = findBestDay(dailySummaries as ProcessedDailySummary[], preference); // Get object

						// --- Update Results Area ---
						resultsDiv.innerHTML = `
							<p>${message}</p>
							<button id="show-more-button" class="btn-secondary">Show 5-Day Forecast</button>
							<div id="detailed-forecast" class="hidden"></div>
						`;

						// Add event listener to the new button
						const showMoreButton = document.getElementById('show-more-button');
						if (showMoreButton) {
							showMoreButton.addEventListener('click', () => {
								displayDetailedForecast(dailySummaries as ProcessedDailySummary[]);
							});
						}
					} else {
						console.log("Failed to create daily summaries.");
						resultsDiv.innerHTML = `<p>${getRandomResponse('error', {reason: 'Could not process forecast'})}</p>`;
					}
				} else {
					console.log("Failed to fetch weather data or list was empty.");
					// Error message should already be set by fetchWeatherData or findBestDay
					if (!resultsDiv.innerHTML?.includes("Error:")) {
						resultsDiv.innerHTML = `<p>${getRandomResponse('error', {reason: 'Failed to fetch forecast'})}</p>`;
					}
				}

				// Ensure results are visible and re-enable buttons
				fadeInElement(resultsDiv); // Use fade-in again to ensure visibility
				preferenceButtons.forEach(btn => (btn as HTMLButtonElement).disabled = false);
				console.log("Analysis complete. Results displayed.");
			});
		});