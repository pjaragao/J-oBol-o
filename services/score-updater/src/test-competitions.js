const API_KEY = 'db348925fb074588b7172f49d528e55d';

async function testCompetitions() {
  console.log("Testing Competitions...");
  try {
    const url = `https://api.football-data.org/v4/competitions`;
    const res = await fetch(url, {
      headers: { 'X-Auth-Token': API_KEY }
    });
    console.log(`Status: ${res.status}`);
    const data = await res.json();
    console.log("Competitions response keys:", Object.keys(data));
    if (data.competitions) {
      console.log(`Total competitions returned: ${data.competitions.length}`);
      console.log(data.competitions.map(c => ({
        id: c.id,
        name: c.name,
        code: c.code,
        plan: c.plan
      })));
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

testCompetitions();
