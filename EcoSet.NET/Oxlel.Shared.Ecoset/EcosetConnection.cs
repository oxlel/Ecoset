using System;
using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json;

namespace Oxlel.Shared.Ecoset
{
    public class EcosetConnection : IGeoSpatialConnection
    {
        private string _endpoint;

        public EcosetConnection(string endpoint)
        {
            _endpoint = endpoint;
        }

        public async Task<JobFetchResponse> FetchResultAsync(JobId id)
        {
            var request = new JobFetchRequest()
            {
                JobId = id.Id
            };
            var result = await Post<JobFetchResponse>("/fetch", request);
            return result;
        }

        public async Task<JobStatus> GetJobStatusAsync(JobId id)
        {
            var request = new JobPollRequest()
            {
                JobId = id.Id
            };
            var result = await Post<JobPollResponse>("/poll", request);
            return result.JobStatus;
        }

        public async Task<JobId> SubmitJobAsync(JobSubmissionRequest request)
        {
            var result = await Post<JobSubmissionResponse>("/submit", request);
            return new JobId(result.JobId);
        }

        private async Task<T> Post<T>(string endpoint, object request)
        {
            using (var client = new HttpClient())
            {
                client.BaseAddress = new Uri(_endpoint);
                client.DefaultRequestHeaders.Accept.Clear();
                client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

                var json = JsonConvert.SerializeObject(request);
                var httpContent = new StringContent(json, Encoding.UTF8, "application/json");

                var req = new HttpRequestMessage(HttpMethod.Post, endpoint);
                req.Content = httpContent;

                var response = await client.SendAsync(req, HttpCompletionOption.ResponseHeadersRead);
                Console.WriteLine(response);

                if (response.IsSuccessStatusCode)
                {
                    string jsonMessage;
                    using (Stream responseStream = await response.Content.ReadAsStreamAsync())
                    {
                        jsonMessage = new StreamReader(responseStream).ReadToEnd();
                    }

                    T responseContent = (T)JsonConvert.DeserializeObject(jsonMessage, typeof(T));
                    return responseContent;
                }
                else {
                    throw new HttpRequestException("The request was not successful: " + response.StatusCode);
                }
            }
        }

        public Task<JobFetchResponse> TryFetchResultAsync(JobId id)
        {
            throw new NotImplementedException();
        }

    }
}
