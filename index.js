
const axios = require('axios');
const fs = require('fs');
const steam = require('steamidconvert')();

const api = 'http://logs.tf/api/v1/log/';

const calculatePlayerStats = async () => {
    const logs = JSON.parse(fs.readFileSync('./matchLogs.json', 'utf8'));
    let playerStats = {};

    let logData = [];
    for (const matchId of logs.logs) {
        try {
            let currentLogData = await getLogData(matchId);
            currentLogData.logId = matchId;
            logData.push(currentLogData);
            await new Promise(r => setTimeout(r, 10));
        } catch (error) {
            console.error(error.message);
        }
    }

    for (const log of logData) {
        for (const playerKey in log.players) {
            let currentPlayerStats = log.players[playerKey].class_stats;
            for (const currentClass of currentPlayerStats) {
                if (!playerStats[currentClass.type]) {
                    playerStats[currentClass.type] = {};
                }

                let playerAlias = log.names[playerKey];

                if (!playerStats[currentClass.type][playerKey]) {
                    playerStats[currentClass.type][playerKey] = {
                        /*steam64id: convertSteamId3ToSteamId64(playerKey),*/
                        steam3id: playerKey,
                        aliases: playerAlias,
                        kills: currentClass.kills,
                        deaths: currentClass.deaths,
                        assists: currentClass.assists,
                        avgDpm: (currentClass.dmg / (currentClass.total_time / 60)).toFixed(2),
                        avgDtm: (log.players[playerKey].dt / (currentClass.total_time / 60)).toFixed(2),
                        deltaDmg: (currentClass.dmg / (currentClass.total_time / 60)).toFixed(2) - (log.players[playerKey].dt / (currentClass.total_time / 60)).toFixed(2),
                        "K/D": (currentClass.kills / currentClass.deaths).toFixed(2),
                        "KA/D": ((currentClass.kills + currentClass.assists) / currentClass.deaths).toFixed(2),
                        "K/30": (currentClass.kills / (currentClass.total_time / 60) * 30).toFixed(2),
                        "D/30": (currentClass.deaths / (currentClass.total_time / 60) * 30).toFixed(2),
                        totalDamageTaken: log.players[playerKey].dt,
                        totalDamage: currentClass.dmg,
                        totalTime: currentClass.total_time,
                        logs: (log.logId).toString()
                    }
                } else {
                    playerStats[currentClass.type][playerKey].kills += currentClass.kills;
                    playerStats[currentClass.type][playerKey].deaths += currentClass.deaths;
                    playerStats[currentClass.type][playerKey].assists += currentClass.assists;
                    playerStats[currentClass.type][playerKey].totalDamage += currentClass.dmg;
                    playerStats[currentClass.type][playerKey].totalDamageTaken += log.players[playerKey].dt;
                    playerStats[currentClass.type][playerKey].totalTime += currentClass.total_time;

                    let totalDmg = playerStats[currentClass.type][playerKey].totalDamage;
                    let totalDmgTaken = playerStats[currentClass.type][playerKey].totalDamageTaken;
                    let totalTime = playerStats[currentClass.type][playerKey].totalTime;
                    playerStats[currentClass.type][playerKey].avgDpm = (totalDmg / (totalTime / 60)).toFixed(2);
                    playerStats[currentClass.type][playerKey].avgDtm = (totalDmgTaken / (totalTime / 60)).toFixed(2);
                    playerStats[currentClass.type][playerKey].deltaDamage = (playerStats[currentClass.type][playerKey].avgDpm - playerStats[currentClass.type][playerKey].avgDtm).toFixed(2);

                    let totalKills = playerStats[currentClass.type][playerKey].kills;
                    let totalAssists = playerStats[currentClass.type][playerKey].assists;
                    let totalDeaths = playerStats[currentClass.type][playerKey].deaths;

                    playerStats[currentClass.type][playerKey]["K/D"] = (totalKills / totalDeaths).toFixed(2);
                    playerStats[currentClass.type][playerKey]["KA/D"] = ((totalKills + totalAssists) / totalDeaths).toFixed(2);
                    playerStats[currentClass.type][playerKey]["K/30"] = (totalKills / (totalTime / 60) * 30).toFixed(2);
                    playerStats[currentClass.type][playerKey]["D/30"] = (totalDeaths / (totalTime / 60) * 30).toFixed(2);

                    let aliases = playerStats[currentClass.type][playerKey].aliases.split(', ');
                    if (!aliases.includes(playerAlias)) {
                        playerStats[currentClass.type][playerKey].aliases += `, ${playerAlias}`;
                    }

                    playerStats[currentClass.type][playerKey].logs += `, ${log.logId}`;
                    if (!playerStats[currentClass.type][playerKey].aliases[playerAlias]) {
                        playerStats[currentClass.type][playerKey].aliases[playerAlias] = playerAlias;
                    }
                }
            }
        }
    }

    fs.writeFile('./totalPlayerStats.json', JSON.stringify(playerStats, null, 2), err => {
        if (err) throw err;
    })
}

const calculateMedicValues = async () => {
    const medics = JSON.parse(fs.readFileSync('./medics.json', 'utf8'));
    let medicStats = {};

    // Loop through each medic and get their logs/stats
    for (const [medic, medicData] of Object.entries(medics.medics)) {
        const medicId = convertSteamId64ToSteamId3(medicData.rglId);

        let logs = [];
        for (const matchId of medicData.matchLogs) {
            try {
                let logData = await getLogData(matchId);
                logs.push(logData);
                await new Promise(r => setTimeout(r, 100));
            } catch (error) {
                console.error(error.message);
            }
        }

        medicStats[medic] = getMedicStats(logs, medicId);
    }

    // Write stats to file
    fs.writeFile('./medicStats.json', JSON.stringify(medicStats, null, 2), err => {
        if (err) throw err;
    })
}

const getLogData = async (logId) => {
    const logData = (await axios.get(api + logId)).data;
    
    return logData;
}

const getMedicStats = (logs, medicId) => {
    let deaths = 0;
    let ubers = 0;
    let drops = 0;
    let hpm = 0;

    for (const log of logs) {
        deaths += (log.players[medicId].deaths / (log.length / 60) * 30);
        ubers += (log.players[medicId].ubers / (log.length / 60) * 30);
        drops += (log.players[medicId].drops / (log.length / 60) * 30);
        hpm += (log.players[medicId].heal / (log.length / 60));
    }

    return {
        medicId,
        "hpm": (hpm / logs.length).toFixed(2),
        "drops": (drops / logs.length).toFixed(2),
        "ubers": (ubers / logs.length).toFixed(2),
        "deaths": (deaths / logs.length).toFixed(2),
    }
}

const convertSteamId64ToSteamId3 = (steamId64) => {
    let steamId = steam.convertToText(steamId64);
    return steam.convertToNewFormat(steamId);
}

const convertSteamId3ToSteamId64 = (steamId3) => {
    return steam.convertTo64(steamId3);
}

//calculateMedicValues();
calculatePlayerStats();