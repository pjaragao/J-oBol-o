const API_KEY = 'db348925fb074588b7172f49d528e55d';

async function testWcMatches() {
  console.log("Testing World Cup Matches...");
  try {
    const today = new Date().toISOString().split('T')[0];
    console.log(`Current date: ${today}`);

    // Call /v4/competitions/WC/matches for today
    const urlToday = `https://api.football-data.org/v4/competitions/WC/matches?dateFrom=${today}&dateTo=${today}`;
    console.log(`Fetching from: ${urlToday}`);
    let res = await fetch(urlToday, {
      headers: { 'X-Auth-Token': API_KEY }
    });
    console.log(`Today matches Status: ${res.status}`);
    const textToday = await res.text();
    console.log("Today matches Response:");
    console.log(textToday);

    // Call /v4/competitions/WC/matches (all matches)
    const urlAll = `https://api.football-data.org/v4/competitions/WC/matches`;
    console.log(`Fetching from: ${urlAll}`);
    res = await fetch(urlAll, {
      headers: { 'X-Auth-Token': API_KEY }
    });
    console.log(`All matches Status: ${res.status}`);
    const dataAll = await res.json();
    console.log(`All matches count: ${dataAll.matches?.length}`);
    if (dataAll.matches && dataAll.matches.length > 0) {
      console.log("First 3 matches:");
      console.log(JSON.stringify(dataAll.matches.slice(0, 3), null, 2));
    }
  } catch (error) {
    console.error("Error fetching WC matches:", error);
  }
}

testWcMatches();
