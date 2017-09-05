![OxLEL Logo](http://i.imgur.com/2DXRhTt.png)

# Ecoset

*Author: Philip Holland*

## Overview

Ecoset is a tool originally developed to provide the [LEFT](https://oxlel.zoo.ox.ac.uk/research/projects/local-ecological-footprinting-tool-left) tool with geospatial data. When running on a server, Ecoset exposes an easy-to-use JSON powered API. A connecting client can use this API to submit an "Ecoset job" - specifying a geographical extent (latitude/longitude boundaries), and a list of "executables" (explained below) to produce desired data for this extent. As a result, different LEFT-like tools can use Ecoset to supply geospatial data that is relevant specifically to the tool, without major changes to the Ecoset source code.

## Architecture

![Architecture Diagram](https://i.imgur.com/rGrMYvr.png)

The above diagram shows the architecture of the complete LEFT project. Ecoset makes up the "GeoTemporal Engine" component, and also manages the "Redis Cache". The executables provided with this project are specific to the LEFT project, but the general ideas can be used for similar projects. The core functionality backing Ecoset is completely generic, and can be used for any geospatial data splicing tool.

- Docker ([docker.com](https://www.docker.com)), along with the "docker-compose" tool are used to ensure dependencies are configured correctly
- Ecoset + the executables run in one Docker container
- The redis cache runs in another container
- Docker compose is used to link the containers (see: [docker.com/compose](https://docs.docker.com/compose/))

### Project Structure

Ecoset consists of three main directories: "api", "executables" and "test". These are all independent. "api" and "test" contain nodejs projects. "executables" contains LEFT-specific scripts. These are also written using node js, but each executable is independent.

## Running Ecoset

### Running the tests

The following commands will run the test suite:

`docker-compose -f docker-compose.test.yml build`

`docker-compose -f docker-compose.test.yml up`


### Running the application

The `docker-compose.yml` file is used to configure the overall Docker application. **However, the application will not run correctly without further configuration!** Another docker-compose config file must be created, to mount volumes and expose ports to allow data transfer between the host (e.g. development) machine and the Docker virtual machines. An example configuration file is provided (called `docker-compose.development.yml.template`).

Once this configuration file has been created, the application can be ran with the following commands:

`docker-compose -f docker-compose.yml -f docker-compose.development.yml build`

`docker-compose -f docker-compose.yml -f docker-compose.development.yml up`

## API

Ecoset defines three API endpoints:

1. `/submit`
2. `/poll`
3. `/fetch`

These can be accessed through the port defined and exposed in the docker-compose config file described above.

#### *Submit*
`/submit`

This endpoint accept a POST request supplying JSON data specifying an extent and a list of executables. An example JSON request object looks like this:

```json
{
    "north": 55.121,
    "south": 54.767,
    "east": -2.7304,
    "west": -3.5537,
    "executables": [
        {
            "name": "migratory_species_list",
            "implementation": "1",
            "output_format": "datatable"
        },
        {
            "name": "pollination",
            "implementation": "1",
            "output_format": "raw",
            "stat": "degraded"
        }
    ]
} 
```

- "north", "south", "east" and "west" define the lat/lon bounding box of the extent.
- "executables" must be an array of JSON objects.
    - Each sub-object must define a name (of an existing executable), and an "implementation" (of that executable).
    - The "output_format" and "stat" parameters are optional, and the values are executable-specific. They are used to further configure the desired output of the executable.

An example response is:

```json
{
    "success": true,
    "message": "Job successfully submitted, id: c4d79030-2512-11e7-8c2e-e77e1dfe29ba",
    "jobId": "c4d79030-2512-11e7-8c2e-e77e1dfe29ba"
}
```

If invalid JSON is supplied, "success" will return false, and the "message" will outline the issue. On a successful submission, clients can take note of the returned "jobId" parameter, for use with the other endpoints.

#### *Poll*

`/poll`

This endpoint again accepts a POST request, supplying JSON data of the form:

```json
{
    "jobId": "c4d79030-2512-11e7-8c2e-e77e1dfe29ba"
}
```

And returns a response like:

```json
{
    "success": true,
    "message": "Job c4d79030-2512-11e7-8c2e-e77e1dfe29ba is READY",
    "jobState": "READY"
}
```

"success" will return false if there was an issue on the backend while querying for the job's status.

The different states that a job are as follows:

- "PROCESSING" - the job is still running
- "READY" - the job has finished executing and the data can be fetched
- "FAILED" - the job hit an error whilst processing, and has failed
- "NONEXISTENT" - a job with the given jobId does not exist on the server

### Fetch

`/fetch`

Similar to poll, but designed to be sent once a job's state has been found to be "READY". A request looks like:

```json
{
    "jobId": "c4d79030-2512-11e7-8c2e-e77e1dfe29ba"
}
```

And the response for a valid request looks like:

```json
{
    "north": 55.121,
    "south": 54.767,
    "east": -2.7304,
    "west": -3.5537,
    "output": [
        { 
            "name": "migratory_species_list",
            "implementation": "1",
            "output_format": "datatable",
            "stat": "undefined",
            "data": [
                { "latin": "Accipiter gentilis" },
                { "latin": "Accipiter nisus" },
                { "latin": "Alca torda" },
                ...
                { "latin": "Vanellus vanellus" }
            ]
        },
        { 
            "name": "pollination",
            "implementation": "1",
            "output_format": "raw",
            "stat":"degraded", 
            "data": {
                "summary": { 
                    "min": 0,
                    "max": 89,
                    "mean": 75.026,
                    "stdDev": 14.481,
                    "type":"Byte"
                },
                "data": {
                    "ncols": 1000,
                    "nrows": 430,
                    "nodata": 255,
                    "raw": [...]
                }
            }
        }
    ]
}
```

The "..."s represent omitted data.

"ouptut" is an array of JSON objects representing each executable's output using the following guaranteed fields:

- **"name"** : the name of the specific executable
- **"implementation"** : the specified implementation that has been run
- **"output_format"** : the specified output format parameter passed to the executable
- **"stat"** : the specified "stat" parameter passed to the executable
- **"data"** : the actual output data produced by the executable

The contents of the "data" field are specific to each executable. The client must be aware of the output of each executable to interpret this field correctly.

If a job which is not ready is "fetch"ed, a response like the following would occur:

```json
{
    "success": false,
    "message": "Error: Job \"c4d79030-2512-11e7-8c2e-e77e1dfe29ba\" does not exist on the server"
}
```

## Monitoring jobs

One of the exposed ports (5001 by default) exposes a job queue management dashboard (by default, accessible at [localhost:5001/dashboard](http://localhost:5001/dashboard)). This interface shows the status of jobs running through Ecoset. 

![Ecoset Dashboard](http://i.imgur.com/rlBL0As.png)

The output from a job can be seen here (in the scrollable text panel at the bottom of each job's information panel). If the job fails, this output should allow the error to be identified.

## Executables

An "executable" is defined as a standalone system exectuable/script. These are fundamentally separate, and operate like so:

When an executable has been requested by an Ecoset job...
1. Ecoset invokes the executable, and passes it a JSON object as a command line argument with the following format:
```json
{
    "north": ...,               <-- the north (lat) boundary
    "south": ...,               <-- the south (lat) boundary
    "east": ...,                <-- the east (lon) boundary
    "west": ...,                <-- the west (lon) boundary
    "executables": [...],       <-- a list of executable names
    "outputDir": "...",         <-- the path to the job's output directory
    "outputFormat": "...",      <-- the provided 'outputFormat'
    "stat": "..."               <-- the provided 'stat'
}
```
2. The executable runs, and creates a `[exec_name]_output.json` file in the job's specific "output directory"
    - [exec_name] is replaced with the specific executable's name, e.g. pollination_output.json
3. Ecoset takes the contents of this `_output.json` file, along with the output of other executables, to form a main `output.json` file to send back on a "fetch" request

**Each executable must be registered with Ecoset**

- This is done in the `default.json` configuration file in the "api/config" directory

---

Provided with this project are the executables used to power LEFT. These can be split into categories:

### "Merge and window" type executables

These executables are all functionally equivalent, but operate on different tiled data sources.

Each operates in the same way:

1. Using the specified extent, the relevant GeoTiff tiles which overlap the area of interest are retrieved from the source directory
2. These tiles are merged (stitched) together to create a single, large GeoTiff
3. Using the large GeoTiff, the area of interest is cropped out into its own GeoTiff
4. The data from this final GeoTiff is converted into ASCII (raw data values)
    - If the executable's "stat" parameter has been set to "degraded", the output data will be scaled to no larger than 1000 "pixels" in both width and height (aspect ratio is retained)
5. The ASCII data is written to the output.json of the overall job response

Here is an example of merge and window executable output:

```json
{ 
    "name": "pollination",
    "implementation": "1",
    "output_format": "raw",
    "stat":"degraded", 
    "data": {
        "summary": { 
            "min": 0,
            "max": 89,
            "mean": 75.026,
            "stdDev": 14.481,
            "type":"Byte"
        },
        "data": {
            "ncols": 1000,
            "nrows": 430,
            "nodata": 255,
            "raw": [...]
        }
    }
}
```

"raw" is a 2d array of raw integer pixel values.

If only the "summary" data is required - specify the `output_type` to be "datatable", and `stat` as "summary"

### SEV

The included SEV executable is unique. It's configuration looks like this:

```json
{
    "executables": [
        {
            "name": "vulnerability",
            "weight": 1
        },
        {
            "name": "intactness",
            "weight": 1
        },
        {
            "name": "resilience",
            "weight": 1
        },
        {
            "name": "beta_diversity",
            "weight": 1
        },
        {
            "name": "migratory",
            "weight": 0.5
        },
        {
            "name": "wetlands",
            "weight": 0.5
        }
    ]
}
```

Each of the defined merge and window executables in the configuration file as above MUST also be specified to run in the submit query, with "raw" output_format. The size of each component executable's output must be identical.

### Shapefile intersection executables

migratory_species_list and vulnerable_species_list are executables that return data from a shapefile from the geometries that overlap the area of interest.

They operate like so:

1. Using the "ogr2ogr" tool, the input shapefile is cropped to the area of interest and converted into a GeoJSON output file
    - The cropping procedure automatically strips out geometries which do not overlap the bounding box
2. The GeoJSON file is iterated over - each overlapping geometry's metadata ("property" data) is outputted to the final response json file

Example output:

```json
{ 
    "name": "migratory_species_list",
    "implementation": "1",
    "output_format": "datatable",
    "stat": "undefined",
    "data": [
        { "latin": "Accipiter gentilis" },
        { "latin": "Accipiter nisus" },
        { "latin": "Alca torda" },
        ...
        { "latin": "Vanellus vanellus" }
    ]
}
```

Each item in the "data" array is an object with fields specific to the shapefile that was used. In the above case, the shapefile defined strings of the latin name represented by each geometry.

### GBIF list executable

The GBIF list executable ("gbif_list") is unique - it takes the input extent and uses it to query a specially configured GBIF mirror database. The result is a JSON array of every GBIF occurrence record stored in the database with its coordinate location within the extent.

Example output:

```json
{
    "name": "gbif_list",
    "implementation": "1",
    "output_format": "undefined",
    "stat": "undefined",
    "data": [
        {
            "genus": "Apus",
            "species": "Apus apus",
            "lat": 47.3833,
            "lon": 8.16667,
            "kingdom": "Animalia",
            "class": "Aves",
            "institutionCode": "UCT-ADU",
            "title": "South African National Biodiversity Institute"
        },
        ...
    ]
}
```

The local configuration must be correct to allow a MySQL connection to be established.