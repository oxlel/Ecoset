using System;

namespace Oxlel.Shared.Ecoset
{
    public class JobId
    {
        public JobId(Guid id)
        {
            Id = id;
        }

        public Guid Id { get; private set; }
    }
}