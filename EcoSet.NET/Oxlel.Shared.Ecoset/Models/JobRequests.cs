using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace Oxlel.Shared.Ecoset
{
    public class JobSubmissionRequest
    {
        [JsonProperty("north")]
        public double North { get; set; }
        [JsonProperty("south")]
        public double South { get; set; }
        [JsonProperty("east")]
        public double East { get; set; }
        [JsonProperty("west")]
        public double West { get; set; }
        [JsonProperty("executables")]
        public List<Executable> Executables { get; set; }
    }

    public class Executable
    {
        [JsonProperty("name")]
        public string Name { get; set; }
        [JsonProperty("implementation")]
        public string Implementation { get; set; }
        [JsonProperty("output_format")]
        public string OutputFormat { get; set; }
        [JsonProperty("stat")]
        public string Stat { get; set; }
    }

    public class JobPollRequest
    {
        [JsonProperty("jobId")]
        public Guid JobId { get; set; }
    }

    public class JobFetchRequest
    {
        [JsonProperty("jobId")]
        public Guid JobId { get; set; }
    }
}