using System.Collections.Generic;
using Newtonsoft.Json;

namespace Oxlel.Shared.Ecoset.Parsers
{
    public class FileParser : IParser<FileResult>
    {
        public FileResult TryParse(string raw)
        {
            var parsed = JsonConvert.DeserializeObject<FileEcosetResult>(raw);
            var model = new FileResult();
            model.Base64Data = parsed.Base64;
            //model.FileFormat = parsed.FileFormat;
            return model;
        }

        private class FileEcosetResult 
        {
            [JsonProperty("base64")]
            public string Base64 { get; set; }
            //public string FileFormat { get; set; }
        }
    }
}