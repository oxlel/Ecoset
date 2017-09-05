using System.Collections.Generic;
using Newtonsoft.Json;

namespace Oxlel.Shared.Ecoset.Parsers
{
    public class DataTableParser : IParser<DataTableListResult>
    {
        public DataTableListResult TryParse(string raw)
        {
            var parsed = JsonConvert.DeserializeObject<List<Dictionary<string, string>>>(raw);
            var model = new DataTableListResult();
            model.Rows = parsed;
            return model;
        }
    }

    public class DataTableStatsParser : IParser<DataTableStatsResult>
    {
        public DataTableStatsResult TryParse(string raw)
        {
            var parsed = (RawEcosetSummaryData)JsonConvert.DeserializeObject(raw, typeof(RawEcosetSummaryData));
            var result = new DataTableStatsResult() 
            {
                Stats = parsed.Stats
            };
            return result;
        }

        private class RawEcosetSummaryData
        {
            [JsonProperty("summary")]
            public Statistics Stats { get; set; }
        }
    }
}