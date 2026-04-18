import axios from 'axios';

const parseRSS = (xmlString) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');

  const episodes = [];
  const items = doc.querySelectorAll('item');

  items.forEach((item) => {
    const title = item.querySelector('title')?.textContent || '';
    const description = item.querySelector('description')?.textContent || '';
    const pubDate = item.querySelector('pubDate')?.textContent || '';
    const guid = item.querySelector('guid')?.textContent || '';
    const enclosure = item.querySelector('enclosure');
    const duration = item.querySelector('duration')?.textContent || '';

    // Extract guest name from description (assumes format like "Guest: Name")
    const guestMatch = description.match(/[Gg]uest:?\s*([^\n<]+)/);
    const guest = guestMatch ? guestMatch[1].trim() : '';

    episodes.push({
      id: guid,
      title,
      description: description.replace(/<[^>]*>/g, '').substring(0, 200),
      guest,
      pubDate: new Date(pubDate),
      duration,
      audioUrl: enclosure?.getAttribute('url') || '',
    });
  });

  return episodes.sort((a, b) => b.pubDate - a.pubDate);
};

export const fetchEpisodes = async () => {
  try {
    const feedUrl = process.env.NEXT_PUBLIC_SIMPLECAST_FEED_URL;
    if (!feedUrl) {
      console.warn('NEXT_PUBLIC_SIMPLECAST_FEED_URL not configured');
      return [];
    }

    const response = await axios.get(feedUrl);
    return parseRSS(response.data);
  } catch (error) {
    console.error('Error fetching episodes:', error);
    return [];
  }
};
