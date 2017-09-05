namespace Oxlel.Shared.Ecoset.Parsers
{
    public interface IParser<T>
    {
        T TryParse(string raw);
    }
}