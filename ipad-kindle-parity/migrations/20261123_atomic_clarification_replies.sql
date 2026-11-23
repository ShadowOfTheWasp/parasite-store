-- Parasite V3 gate 3: atomic same-request clarification reply.
-- Additive only. Never rewrite the original request brief.
BEGIN;
CREATE TABLE IF NOT EXISTS parasite_queue.replies (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 request_id uuid NOT NULL REFERENCES parasite_queue.requests(id) ON DELETE RESTRICT,
 reply text NOT NULL CHECK (length(trim(reply)) BETWEEN 1 AND 4000),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS replies_request_id_idx ON parasite_queue.replies(request_id,created_at);
REVOKE ALL ON parasite_queue.replies FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON parasite_queue.replies TO service_role;
GRANT USAGE, SELECT ON SEQUENCE parasite_queue.replies_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.parasite_creator_reply(api_token text, request_id uuid, reply_text text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $func$
DECLARE entry parasite_queue.requests;
DECLARE reply_id bigint;
BEGIN
 IF api_token IS NULL OR NOT EXISTS (SELECT 1 FROM parasite_queue.config WHERE key_digest=encode(sha256(convert_to(api_token,'UTF8')),'hex')) THEN
  RAISE SQLSTATE '28000' USING MESSAGE='Invalid queue credential';
 END IF;
 IF request_id IS NULL OR length(trim(coalesce(reply_text,''))) NOT BETWEEN 1 AND 4000 THEN
  RAISE SQLSTATE '22023' USING MESSAGE='Reply must be between 1 and 4000 characters';
 END IF;
 SELECT * INTO entry FROM parasite_queue.requests WHERE id=request_id FOR UPDATE;
 IF NOT FOUND THEN RAISE SQLSTATE 'P0002' USING MESSAGE='Request not found'; END IF;
 IF entry.state <> 'needs_input' THEN RAISE SQLSTATE '55000' USING MESSAGE='Request is not waiting for input'; END IF;
 INSERT INTO parasite_queue.replies(request_id,reply) VALUES(request_id,trim(reply_text)) RETURNING id INTO reply_id;
 UPDATE parasite_queue.requests SET state='queued',updated_at=now(),note='Owner replied; resume original request. Reply ID '||reply_id WHERE id=request_id;
 RETURN jsonb_build_object('id',request_id,'state','queued','reply_id',reply_id);
END;
$func$;
REVOKE ALL ON FUNCTION public.parasite_creator_reply(text,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.parasite_creator_reply(text,uuid,text) TO service_role;
COMMIT;
