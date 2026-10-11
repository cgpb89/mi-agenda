import { describe, expect, it } from 'vitest';
import { imageUrl, signParams } from '@/lib/cloudinary/sign';
import { MAX_PHOTOS, movePhoto, readPhotos } from '@/modules/businesses/photos';

describe('cloudinary signing', () => {
  it('matches the example from the Cloudinary docs', () => {
    expect(
      signParams(
        {
          eager: 'w_400,h_300,c_pad|w_260,h_200,c_crop',
          public_id: 'sample_image',
          timestamp: 1315060510,
        },
        'abcd',
      ),
    ).toBe('bfd09f95f331f558cbd1320e67aa8d488770583e');
  });

  it('builds resized delivery URLs', () => {
    expect(imageUrl('demo', 'tempo/a/b', 12, { width: 640 })).toBe(
      'https://res.cloudinary.com/demo/image/upload/c_limit,w_640/f_auto/q_auto/v12/tempo/a/b',
    );
    expect(imageUrl('demo', 'x', 1, { width: 480, height: 360 })).toContain(
      '/c_fill,g_auto,w_480,h_360/',
    );
  });
});

describe('booking-page photos', () => {
  const photo = (n: number) => ({
    id: `00000000-0000-4000-8000-00000000000${n}`,
    publicId: `tempo/t/${n}`,
    version: 1,
    width: 800,
    height: 600,
  });

  it('reads valid photo lists and rejects malformed or oversized ones', () => {
    expect(readPhotos([photo(1), photo(2)])).toHaveLength(2);
    expect(readPhotos([{ id: 'nope' }])).toEqual([]);
    expect(readPhotos(Array.from({ length: MAX_PHOTOS + 1 }, (_, i) => photo(i)))).toEqual([]);
    expect(readPhotos(null)).toEqual([]);
  });

  it('moves a photo one place and ignores moves past the ends', () => {
    const list = [photo(1), photo(2), photo(3)];
    expect(movePhoto(list, photo(2).id, -1).map((p) => p.publicId)).toEqual([
      'tempo/t/2',
      'tempo/t/1',
      'tempo/t/3',
    ]);
    expect(movePhoto(list, photo(3).id, 1)).toBe(list);
    expect(movePhoto(list, 'missing', 1)).toBe(list);
  });
});
