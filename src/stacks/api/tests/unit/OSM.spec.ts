import { getLatLong } from "../../services/osm";


beforeEach(() => {
    global.fetch = jest.fn();
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe("GetLatLong", () => {
    it("Should return lat long when county matches region", async () => {
        const city = "city"
        const region = "region"
        const country = "country"
        const features = [
            {
                properties: {
                    geocoding: {
                        osm_key: "place",
                        name: city,
                        county: region,
                        state: "State",
                        country: country,
                        country_code: "CC"
                    }
                },
                geometry: {
                    type: "Point",
                    coordinates: [1, 1]
                }
            }
        ]
        const res = new Response(JSON.stringify({ features }))
        jest.spyOn(global, 'fetch').mockResolvedValue(res)
        const coords = await getLatLong(city, region, country)
        expect(coords).toEqual(features[0].geometry.coordinates)
    })
    it("Should return lat long when state matches region", async () => {
        const city = "city"
        const region = "region"
        const country = "country"
        const features = [
            {
                properties: {
                    geocoding: {
                        osm_key: "place",
                        name: city,
                        county: "county",
                        state: region,
                        country: country,
                        country_code: "CC"
                    }
                },
                geometry: {
                    type: "Point",
                    coordinates: [1, 1]
                }
            }
        ]
        const res = new Response(JSON.stringify({ features }))
        jest.spyOn(global, 'fetch').mockResolvedValue(res)
        const coords = await getLatLong(city, region, country)
        expect(coords).toEqual(features[0].geometry.coordinates)
    })
    it("Should return null when any check doesnt pass", async () => {
        const city = "city"
        const region = "region"
        const country = "country"
        const features = [
            {
                properties: {
                    geocoding: {
                        osm_key: "place",
                        name: "Wrong City", // City check fails
                        county: "county",
                        state: region,
                        country: country,
                        country_code: "CC"
                    }
                },
                geometry: {
                    type: "Point",
                    coordinates: [1, 1]
                }
            },
            {
                properties: {
                    geocoding: {
                        osm_key: "place",
                        name: city,
                        county: "Wrong Region", // Region check fails
                        state: "Wrong Region",
                        country: country,
                        country_code: "CC"
                    }
                },
                geometry: {
                    type: "Point",
                    coordinates: [1, 1]
                }
            },
            {
                properties: {
                    geocoding: {
                        osm_key: "place",
                        name: city,
                        county: "county",
                        state: region,
                        country: "Wrong Country", // Country check fails
                        country_code: "CC"
                    }
                },
                geometry: {
                    type: "Point",
                    coordinates: [1, 1]
                }
            },
            {
                properties: {
                    geocoding: {
                        osm_key: "Wrong key", // osm_key check fails
                        name: city,
                        county: "county",
                        state: region,
                        country: country,
                        country_code: "CC"
                    }
                },
                geometry: {
                    type: "Point",
                    coordinates: [1, 1]
                }
            }
        ]
        const res = new Response(JSON.stringify({ features }))
        jest.spyOn(global, 'fetch').mockResolvedValue(res)
        const coords = await getLatLong(city, region, country)
        expect(coords).toEqual(null)
    })
})