using Newtonsoft.Json;

namespace Oxlel.Shared.Ecoset.Parsers
{
    public class RawParser : IParser<RawDataResult>
    {
        public RawDataResult TryParse(string raw)
        {
            var parsed = (RawEcosetData)JsonConvert.DeserializeObject(raw, typeof(RawEcosetData));
            var result = new RawDataResult() 
            {
                Stats = parsed.Stats,
                DataCube = parsed.Data.Data
            };
            return result;
        }

        private class RawEcosetData
        {
            [JsonProperty("summary")]
            public Statistics Stats { get; set; }
            [JsonProperty("data")]
            public RawDataset Data { get; set; }
        }

        private class RawDataset
        {
            [JsonProperty("raw")]
            public double[,] Data { get; set; }
        }
    }
}