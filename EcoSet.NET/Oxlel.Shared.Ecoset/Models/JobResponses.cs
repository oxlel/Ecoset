using System;
using System.Collections.Generic;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Oxlel.Shared.Ecoset
{
    public class JobPollResponse
    {
        [JsonProperty("success")]
        public bool Success { get; set; }
        [JsonProperty("message")]
        public string Message { get; set; }
        [JsonProperty("jobState")]
        public JobStatus JobStatus { get; set; }
    }

    public class JobFetchResponse
    {
        [JsonProperty("north")]
        public float North { get; set; }

        [JsonProperty("south")]
        public float South { get; set; }

        [JsonProperty("east")]
        public float East { get; set; }

        [JsonProperty("west")]
        public float West { get; set; }

        [JsonProperty("output")]
        public EcosetOutput[] Outputs { get; set; }
    }

    public class JobSubmissionResponse
    {
        [JsonProperty("success")]
        public bool Success { get; set; }
        [JsonProperty("message")]
        public string Message { get; set; }
        [JsonProperty("jobId")]
        public Guid JobId { get; set; }
    }

    public class EcosetOutput
    {
        public string Name { get; set; }
        public string Implementation { get; set; }
        [JsonProperty("output")]
        public string OutputFormat { get; set; }
        [JsonProperty("data")]
        public JToken Data { get; set; }
    }

    public class Statistics
    {
        public float Min { get; set; }
        public float Max { get; set; }
        public float Mean { get; set; }
        public float StdDev { get; set; }
    }

    public class ExecutableResult
    {
        public string Name { get; set; }
        public string Implementation { get; set; }

        public string OutputFormat { get; set; }
        public IDataResult RawData { get; set; }
    }

    public interface IDataResult { }

    public class RawDataResult : IDataResult
    {
        public Statistics Stats { get; set; }
        public double[,] DataCube { get; set; }
    }

    public class DataTableListResult : IDataResult
    {
        public List<Dictionary<string,string>> Rows { get; set; }
    }

    public class DataTableStatsResult : IDataResult
    {
        public Statistics Stats { get; set; }
    }

    public class FileResult : IDataResult {
        public string Base64Data { get; set; }
        public string FileFormat { get; set; }
    }
}