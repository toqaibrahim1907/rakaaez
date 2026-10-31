module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'reviews_not_configured' });
  const headers = { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey };
  try {
    let placeId = process.env.GOOGLE_PLACE_ID;
    let placeName = '';
    if (!placeId) {
      const search = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: { ...headers, 'X-Goog-FieldMask': 'places.id,places.displayName' },
        body: JSON.stringify({ textQuery: 'شركة الركائز البشرية للاستقدام، عنيزة، السعودية', languageCode: 'ar', pageSize: 3 })
      });
      if (!search.ok) {
        console.error('Google Places search returned', search.status);
        return res.status(502).json({ error: 'reviews_unavailable' });
      }
      const results = await search.json();
      const place = (results.places || []).find(item => (item.displayName?.text || '').includes('الركائز البشرية'));
      if (!place?.id) return res.status(404).json({ error: 'company_place_not_found' });
      placeId = place.id;
      placeName = place.displayName?.text || '';
    }
    const details = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=ar`, {
      headers: { ...headers, 'X-Goog-FieldMask': 'id,displayName,rating,userRatingCount,reviews,googleMapsUri' }
    });
    if (!details.ok) {
      console.error('Google Place details returned', details.status);
      return res.status(502).json({ error: 'reviews_unavailable' });
    }
    const place = await details.json();
    const reviews = (place.reviews || []).map(review => ({
      rating: review.rating,
      text: review.text?.text || '',
      publishTime: review.publishTime || '',
      authorName: review.authorAttribution?.displayName || '',
      authorUri: review.authorAttribution?.uri || ''
    }));
    return res.status(200).json({ name: place.displayName?.text || placeName, rating: place.rating || null, reviewCount: place.userRatingCount || 0, reviews, mapsUrl: place.googleMapsUri || '' });
  } catch (error) {
    console.error('Google reviews failed', error.message);
    return res.status(502).json({ error: 'reviews_unavailable' });
  }
};

