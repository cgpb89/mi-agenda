'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { AlertDialog } from '@/components/ui/Dialog';
import { FormMessage } from '@/components/ui/Form';
import { useShell } from '@/components/layout/AppShell';
import { useToast } from '@/components/ui/Toast';
import {
  addPhotoAction,
  movePhotoAction,
  preparePhotoUploadAction,
  removePhotoAction,
} from '@/modules/businesses/photo-actions';
import { useI18n } from '@/i18n/client';

export interface EditorPhoto {
  id: string;
  thumb: string;
}

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif';

/**
 * Booking-page photos. Changes apply immediately (they don't wait for the
 * page's "Save changes" bar). Files go straight from the browser to Cloudinary
 * with a short-lived server signature.
 */
export function PhotoManager({
  photos,
  enabled,
  limit,
}: {
  photos: EditorPhoto[];
  enabled: boolean;
  /** Photos allowed by the business's plan. */
  limit: number;
}) {
  const { data } = useShell();
  const slug = data.tenant.slug;
  const router = useRouter();
  const toast = useToast();
  const { t } = useI18n();
  const bp = t.bookingPage;
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const busy = uploading || pending;
  const full = photos.length >= limit;

  async function upload(file: File) {
    setError(null);
    // Some browsers report HEIC files with an empty type, so fall back to the extension.
    const typeOk = ACCEPT.split(',').includes(file.type) || /\.(heic|heif)$/i.test(file.name);
    if (!typeOk) return setError(bp.photoWrongType);
    if (file.size > MAX_BYTES) return setError(bp.photoTooLarge);
    setUploading(true);
    try {
      const signed = await preparePhotoUploadAction(slug);
      if (!signed.ok) return setError(signed.error.message);
      const body = new FormData();
      for (const [k, v] of Object.entries(signed.data!.fields)) body.append(k, v);
      body.append('file', file);
      const res = await fetch(signed.data!.url, { method: 'POST', body }).catch(() => null);
      if (!res?.ok) return setError(bp.photoUploadFailed);
      const saved = await addPhotoAction(slug, { publicId: signed.data!.fields.public_id });
      if (!saved.ok) return setError(saved.error.message);
      toast(bp.toastPhotoAdded);
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  function run(action: () => Promise<{ ok: boolean; error?: { message: string } }>, done?: string) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) return setError(res.error?.message ?? null);
      if (done) toast(done);
      router.refresh();
    });
  }

  return (
    <Card
      tourId="bp-photos"
      title={bp.photos}
      action={
        enabled ? (
          <Button
            variant="primary"
            size="sm"
            disabled={busy || full}
            onClick={() => fileInput.current?.click()}
          >
            {uploading ? bp.uploading : bp.addPhoto}
          </Button>
        ) : null
      }
    >
      <span style={{ fontSize: 12, color: '#6b6358' }}>
        {enabled ? bp.photosHint({ n: limit }) : bp.photosDisabled}
      </span>
      <input
        ref={fileInput}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void upload(file);
        }}
      />
      {enabled && photos.length === 0 ? (
        <span style={{ color: '#5d564b' }}>{bp.noPhotos}</span>
      ) : null}
      {photos.length ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))',
            gap: 12,
          }}
        >
          {photos.map((p, i) => (
            <figure
              key={p.id}
              style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.thumb}
                alt={i === 0 ? bp.cover : bp.photoN({ n: i + 1 })}
                width={480}
                height={360}
                style={{
                  width: '100%',
                  height: 'auto',
                  aspectRatio: '4 / 3',
                  objectFit: 'cover',
                  borderRadius: 10,
                  background: '#ece6db',
                }}
              />
              <figcaption style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                <span style={{ fontWeight: 600, marginRight: 'auto' }}>
                  {i === 0 ? bp.cover : bp.photoN({ n: i + 1 })}
                </span>
                <Button
                  size="sm"
                  aria-label={bp.moveLeft}
                  title={bp.moveLeft}
                  disabled={busy || i === 0}
                  onClick={() => run(() => movePhotoAction(slug, { id: p.id, direction: -1 }))}
                >
                  ←
                </Button>
                <Button
                  size="sm"
                  aria-label={bp.moveRight}
                  title={bp.moveRight}
                  disabled={busy || i === photos.length - 1}
                  onClick={() => run(() => movePhotoAction(slug, { id: p.id, direction: 1 }))}
                >
                  →
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={busy}
                  onClick={() => setRemoving(p.id)}
                >
                  {bp.removePhoto}
                </Button>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : null}
      {error ? <FormMessage kind="error">{error}</FormMessage> : null}
      <AlertDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={bp.removePhoto}
        actions={
          <>
            <Button onClick={() => setRemoving(null)}>{bp.cancel}</Button>
            <Button
              variant="dangerSolid"
              disabled={pending}
              onClick={() => {
                const id = removing!;
                setRemoving(null);
                run(() => removePhotoAction(slug, { id }), bp.toastPhotoRemoved);
              }}
            >
              {bp.removePhoto}
            </Button>
          </>
        }
      >
        {bp.removePhotoConfirm}
      </AlertDialog>
    </Card>
  );
}
