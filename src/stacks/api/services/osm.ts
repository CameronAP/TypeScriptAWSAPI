const OSM_BASE_URL = "https://nominatim.openstreetmap.org/search"

type OSMFeature = {
    type: string
    properties: {
        geocoding: {
            osm_key: string,
            name: string,
            county?: string,
            state: string,
            country: string,
            country_code: string
            admin: object
        }
    },
    geometry: {
        type: string,
        coordinates: number[] // In long lat order
    }

}
type OSMRes = {
    features: OSMFeature[]
}

export async function getLatLong(city: string, region: string, country: string): Promise<number[] | null> {
    city = city.toLowerCase()
    region = region.toLowerCase()
    country = country.toLowerCase()
    console.log(`Searching for location data for: ${city}, ${region}, ${country}`)
    const params = new URLSearchParams({
        q: `${city}, ${region}, ${country}`,
        format: "geocodejson",
        addressdetails: "1",
        limit: "40"
    })
    const res = await fetch(`${OSM_BASE_URL}?${params}`, {
        method: "GET",
        headers: {
            "User-Agent": "curl/8.18.0",
            "Accept": "*/*",
        }
    })
    if (!res.body) {
        console.error("No body returned in the response")
        throw new Error("An Error has occured while querying OSM")
    }

    // OSM is very unreliable with how it categorises things. They admit this themselves in their documentation.
    // Ive added checks that improve the reliablity of the location it returns however this 
    // does add strictness with what the user provide the API otherwise a location may not be found.
    // For any serious implementations the usage OSM with the overpass API should be considered
    const data: OSMRes = JSON.parse(await res.text())
    for (const feature of data.features) {
        console.log("Checking feature:", feature)
        const geocoding = feature.properties.geocoding
        const fCity = geocoding.name.toLowerCase()
        const fCounty = (geocoding.county ?? "").toLowerCase()
        const fState = geocoding.state.toLowerCase()
        const fCountry = geocoding.country.toLowerCase()
        const fCountryCode = geocoding.country_code.toLowerCase()

        const cityCheck = fCity == city
        const regionCheck = fCounty == region || fState == region
        const countryCheck = fCountry == country || fCountryCode == country
        const OSMKeyCheck = ["boundary", "place"].includes(geocoding.osm_key)
        if (countryCheck && regionCheck && cityCheck && OSMKeyCheck) {
            // OSM Returns long lat convert to lat long
            return feature.geometry.coordinates.reverse()
        }
    }
    return null
}