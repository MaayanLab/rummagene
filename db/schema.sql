SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: app_private_v2; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA app_private_v2;


--
-- Name: app_public_v2; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA app_public_v2;


--
-- Name: plpython3u; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS plpython3u WITH SCHEMA pg_catalog;


--
-- Name: EXTENSION plpython3u; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION plpython3u IS 'PL/Python3U untrusted procedural language';


--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: enrich_result; Type: TYPE; Schema: app_public_v2; Owner: -
--

CREATE TYPE app_public_v2.enrich_result AS (
	gene_set_id uuid,
	n_overlap integer,
	odds_ratio double precision,
	pvalue double precision,
	adj_pvalue double precision
);


--
-- Name: TYPE enrich_result; Type: COMMENT; Schema: app_public_v2; Owner: -
--

COMMENT ON TYPE app_public_v2.enrich_result IS '@foreign key (gene_set_id) references app_public_v2.gene_set (id)';


--
-- Name: paginated_enrich_result; Type: TYPE; Schema: app_public_v2; Owner: -
--

CREATE TYPE app_public_v2.paginated_enrich_result AS (
	nodes app_public_v2.enrich_result[],
	total_count integer
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: background; Type: TABLE; Schema: app_public_v2; Owner: -
--

CREATE TABLE app_public_v2.background (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    gene_ids jsonb NOT NULL,
    n_gene_ids integer NOT NULL,
    created timestamp without time zone DEFAULT now()
);


--
-- Name: indexed_enrich(app_public_v2.background, uuid[], character varying, integer, double precision, double precision, integer, integer); Type: FUNCTION; Schema: app_private_v2; Owner: -
--

CREATE FUNCTION app_private_v2.indexed_enrich(background app_public_v2.background, gene_ids uuid[], filter_term character varying DEFAULT NULL::character varying, overlap_ge integer DEFAULT 1, pvalue_le double precision DEFAULT 0.05, adj_pvalue_le double precision DEFAULT 0.05, "offset" integer DEFAULT NULL::integer, first integer DEFAULT NULL::integer) RETURNS app_public_v2.paginated_enrich_result
    LANGUAGE plpython3u IMMUTABLE PARALLEL SAFE
    AS $$
  import requests
  params = dict(
    overlap_ge=overlap_ge,
    pvalue_le=pvalue_le,
    adj_pvalue_le=adj_pvalue_le,
  )
  if filter_term: params['filter_term'] = filter_term
  if offset: params['offset'] = offset
  if first: params['limit'] = first
  req = requests.post(
    f"http://enrich:8000/{background['id']}",
    params=params,
    json=gene_ids,
  )
  total_count = req.headers.get('Content-Range').partition('/')[-1]
  return dict(nodes=req.json(), total_count=total_count)
$$;


--
-- Name: user_gene_set; Type: TABLE; Schema: app_public_v2; Owner: -
--

CREATE TABLE app_public_v2.user_gene_set (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    genes character varying[],
    description character varying DEFAULT ''::character varying,
    created timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: add_user_gene_set(character varying[], character varying); Type: FUNCTION; Schema: app_public_v2; Owner: -
--

CREATE FUNCTION app_public_v2.add_user_gene_set(genes character varying[], description character varying DEFAULT ''::character varying) RETURNS app_public_v2.user_gene_set
    LANGUAGE sql SECURITY DEFINER
    AS $$
  insert into app_public_v2.user_gene_set (genes, description)
  select
    (
      select array_agg(ug.gene order by ug.gene)
      from unnest(add_user_gene_set.genes) ug(gene)
    ) as genes,
    add_user_gene_set.description
  returning *;
$$;


--
-- Name: background_enrich(app_public_v2.background, character varying[], character varying, integer, double precision, double precision, integer, integer); Type: FUNCTION; Schema: app_public_v2; Owner: -
--

CREATE FUNCTION app_public_v2.background_enrich(background app_public_v2.background, genes character varying[], filter_term character varying DEFAULT NULL::character varying, overlap_ge integer DEFAULT 1, pvalue_le double precision DEFAULT 0.05, adj_pvalue_le double precision DEFAULT 0.05, "offset" integer DEFAULT NULL::integer, first integer DEFAULT NULL::integer) RETURNS app_public_v2.paginated_enrich_result
    LANGUAGE sql IMMUTABLE SECURITY DEFINER PARALLEL SAFE
    AS $$
  select r.*
  from app_private_v2.indexed_enrich(
    background_enrich.background,
    (select array_agg(gene_id) from app_public_v2.gene_map(genes) gm),
    background_enrich.filter_term,
    background_enrich.overlap_ge,
    background_enrich.pvalue_le,
    background_enrich.adj_pvalue_le,
    background_enrich."offset",
    background_enrich."first"
  ) r;
$$;


--
-- Name: background_overlap(app_public_v2.background, character varying[], integer); Type: FUNCTION; Schema: app_public_v2; Owner: -
--

CREATE FUNCTION app_public_v2.background_overlap(background app_public_v2.background, genes character varying[], overlap_greater_than integer DEFAULT 0) RETURNS TABLE(gene_set_id uuid, n_overlap_gene_ids integer, n_gs_gene_ids integer)
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
  select
    gs.id as gene_set_id,
    count(ig.gene_id) as n_overlap_gene_ids,
    gs.n_gene_ids as n_gs_gene_ids
  from
    (
      select distinct g.gene_id::text
      from app_public_v2.gene_map(background_overlap.genes) g
    ) ig
    inner join app_public_v2.gene_set gs on gs.gene_ids ? ig.gene_id
  group by gs.id
  having count(ig.gene_id) > background_overlap.overlap_greater_than;
$$;


--
-- Name: current_background(); Type: FUNCTION; Schema: app_public_v2; Owner: -
--

CREATE FUNCTION app_public_v2.current_background() RETURNS app_public_v2.background
    LANGUAGE sql IMMUTABLE STRICT SECURITY DEFINER PARALLEL SAFE
    AS $$
  select *
  from app_public_v2.background
  order by created asc
  limit 1;
$$;


--
-- Name: gene_set; Type: TABLE; Schema: app_public_v2; Owner: -
--

CREATE TABLE app_public_v2.gene_set (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    term character varying NOT NULL,
    gene_ids jsonb NOT NULL,
    n_gene_ids integer NOT NULL,
    created timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: enrich_result_gene_set(app_public_v2.enrich_result); Type: FUNCTION; Schema: app_public_v2; Owner: -
--

CREATE FUNCTION app_public_v2.enrich_result_gene_set(enrich_result app_public_v2.enrich_result) RETURNS app_public_v2.gene_set
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
  select gs.*
  from app_public_v2.gene_set gs
  where gs.id = enrich_result.gene_set_id;
$$;


--
-- Name: gene_map(character varying[]); Type: FUNCTION; Schema: app_public_v2; Owner: -
--

CREATE FUNCTION app_public_v2.gene_map(genes character varying[]) RETURNS TABLE(gene_id uuid, gene character varying)
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $$
  select g.id as gene_id, ug.gene as gene
  from unnest(gene_map.genes) ug(gene)
  inner join app_public_v2.gene g on g.symbol = ug.gene or g.synonyms ? ug.gene;
$$;


--
-- Name: gene_set_gene_search(character varying[]); Type: FUNCTION; Schema: app_public_v2; Owner: -
--

CREATE FUNCTION app_public_v2.gene_set_gene_search(genes character varying[]) RETURNS SETOF app_public_v2.gene_set
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $$
  select distinct gs.*
  from
    app_public_v2.gene_map(genes) g
    inner join app_public_v2.gene_set gs on gs.gene_ids ? g.gene_id::text;
$$;


--
-- Name: gene; Type: TABLE; Schema: app_public_v2; Owner: -
--

CREATE TABLE app_public_v2.gene (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    symbol character varying NOT NULL,
    synonyms jsonb DEFAULT '{}'::jsonb
);


--
-- Name: gene_set_genes(app_public_v2.gene_set); Type: FUNCTION; Schema: app_public_v2; Owner: -
--

CREATE FUNCTION app_public_v2.gene_set_genes(gene_set app_public_v2.gene_set) RETURNS SETOF app_public_v2.gene
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $$
  select g.*
  from app_public_v2.gene g
  where gene_set_genes.gene_set.gene_ids ? g.id::text;
$$;


--
-- Name: gene_set_overlap(app_public_v2.gene_set, character varying[]); Type: FUNCTION; Schema: app_public_v2; Owner: -
--

CREATE FUNCTION app_public_v2.gene_set_overlap(gene_set app_public_v2.gene_set, genes character varying[]) RETURNS SETOF app_public_v2.gene
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
  select distinct g.*
  from app_public_v2.gene_map(gene_set_overlap.genes) gm
  inner join app_public_v2.gene g on g.id = gm.gene_id
  where gene_set.gene_ids ? gm.gene_id::text;
$$;


--
-- Name: gene_set_term_search(character varying[]); Type: FUNCTION; Schema: app_public_v2; Owner: -
--

CREATE FUNCTION app_public_v2.gene_set_term_search(terms character varying[]) RETURNS SETOF app_public_v2.gene_set
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $$
  select distinct gs.*
  from app_public_v2.gene_set gs
  inner join unnest(terms) ut(term) on gs.term ilike ('%' || ut.term || '%');
$$;


--
-- Name: gse_info; Type: TABLE; Schema: app_public_v2; Owner: -
--

CREATE TABLE app_public_v2.gse_info (
    gse character varying,
    pmid character varying,
    pmcid character varying
);


--
-- Name: get_pb_info_by_ids(character varying[]); Type: FUNCTION; Schema: app_public_v2; Owner: -
--

CREATE FUNCTION app_public_v2.get_pb_info_by_ids(pmids character varying[]) RETURNS SETOF app_public_v2.gse_info
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $$
  select *
  from app_public_v2.gse_info
  where pmid = ANY (pmids);
$$;


--
-- Name: pmc_info; Type: TABLE; Schema: app_public_v2; Owner: -
--

CREATE TABLE app_public_v2.pmc_info (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    pmcid character varying NOT NULL,
    title character varying,
    yr integer,
    doi character varying
);


--
-- Name: TABLE pmc_info; Type: COMMENT; Schema: app_public_v2; Owner: -
--

COMMENT ON TABLE app_public_v2.pmc_info IS '@foreignKey (pmcid) references app_public_v2.gene_set_pmc (pmc)';


--
-- Name: get_pmc_info_by_ids(character varying[]); Type: FUNCTION; Schema: app_public_v2; Owner: -
--

CREATE FUNCTION app_public_v2.get_pmc_info_by_ids(pmcids character varying[]) RETURNS SETOF app_public_v2.pmc_info
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $$
  select *
  from app_public_v2.pmc_info
  where pmcid = ANY (pmcIds);
$$;


--
-- Name: release; Type: TABLE; Schema: app_public_v2; Owner: -
--

CREATE TABLE app_public_v2.release (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    n_publications_processed bigint,
    created timestamp without time zone DEFAULT now()
);


--
-- Name: pmc_stats; Type: MATERIALIZED VIEW; Schema: app_private_v2; Owner: -
--

CREATE MATERIALIZED VIEW app_private_v2.pmc_stats AS
 SELECT sum(release.n_publications_processed) AS n_publications_processed
   FROM app_public_v2.release
  WITH NO DATA;


--
-- Name: pmc_stats(); Type: FUNCTION; Schema: app_public_v2; Owner: -
--

CREATE FUNCTION app_public_v2.pmc_stats() RETURNS app_private_v2.pmc_stats
    LANGUAGE sql IMMUTABLE STRICT SECURITY DEFINER PARALLEL SAFE
    AS $$
  select * from app_private_v2.pmc_stats;
$$;


--
-- Name: terms_pmcs_count(character varying[]); Type: FUNCTION; Schema: app_public_v2; Owner: -
--

CREATE FUNCTION app_public_v2.terms_pmcs_count(pmcids character varying[]) RETURNS TABLE(pmc character varying, term character varying, id uuid, count integer)
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $$
  select gsp.pmc, gs.term, gs.id, gs.n_gene_ids as count
  from
    app_public_v2.gene_set_pmc as gsp
    inner join app_public_v2.gene_set as gs on gs.id = gsp.id
  where gsp.pmc = ANY (pmcids);
$$;


--
-- Name: gene_set_pmc; Type: MATERIALIZED VIEW; Schema: app_public_v2; Owner: -
--

CREATE MATERIALIZED VIEW app_public_v2.gene_set_pmc AS
 SELECT gs.id,
    regexp_replace((gs.term)::text, '^(^PMC\d+)(.*)$'::text, '\1'::text) AS pmc
   FROM app_public_v2.gene_set gs
  WITH NO DATA;


--
-- Name: MATERIALIZED VIEW gene_set_pmc; Type: COMMENT; Schema: app_public_v2; Owner: -
--

COMMENT ON MATERIALIZED VIEW app_public_v2.gene_set_pmc IS '@foreignKey (id) references app_public_v2.gene_set (id)';


--
-- Name: gene_set_pmid; Type: MATERIALIZED VIEW; Schema: app_public_v2; Owner: -
--

CREATE MATERIALIZED VIEW app_public_v2.gene_set_pmid AS
 SELECT gs.id,
    gse_info.gse,
    gse_info.pmid,
    gse_info.pmcid
   FROM (app_public_v2.gene_set gs
     JOIN app_public_v2.gse_info gse_info ON ((regexp_replace((gs.term)::text, '^(^GSE\d+)(.*)$'::text, '\1'::text) = (gse_info.gse)::text)))
  WITH NO DATA;


--
-- Name: MATERIALIZED VIEW gene_set_pmid; Type: COMMENT; Schema: app_public_v2; Owner: -
--

COMMENT ON MATERIALIZED VIEW app_public_v2.gene_set_pmid IS '@foreignKey (id) references app_public_v2.gene_set (id)';


--
-- Name: pmc; Type: VIEW; Schema: app_public_v2; Owner: -
--

CREATE VIEW app_public_v2.pmc AS
 SELECT DISTINCT gene_set_pmc.pmc
   FROM app_public_v2.gene_set_pmc;


--
-- Name: VIEW pmc; Type: COMMENT; Schema: app_public_v2; Owner: -
--

COMMENT ON VIEW app_public_v2.pmc IS '@foreignKey (pmc) references app_public_v2.gene_set_pmc (pmc)';


--
-- Name: pmid; Type: VIEW; Schema: app_public_v2; Owner: -
--

CREATE VIEW app_public_v2.pmid AS
 SELECT DISTINCT gene_set_pmid.pmid
   FROM app_public_v2.gene_set_pmid;


--
-- Name: VIEW pmid; Type: COMMENT; Schema: app_public_v2; Owner: -
--

COMMENT ON VIEW app_public_v2.pmid IS '@foreignKey (pmid) references app_public_v2.gene_set_pmid (pmid)';


--
-- Name: pmid_info; Type: TABLE; Schema: app_public_v2; Owner: -
--

CREATE TABLE app_public_v2.pmid_info (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    pmid character varying NOT NULL,
    pmcid character varying,
    title character varying,
    yr integer,
    doi character varying
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version character varying(255) NOT NULL
);


--
-- Name: background background_pkey; Type: CONSTRAINT; Schema: app_public_v2; Owner: -
--

ALTER TABLE ONLY app_public_v2.background
    ADD CONSTRAINT background_pkey PRIMARY KEY (id);


--
-- Name: gene gene_pkey; Type: CONSTRAINT; Schema: app_public_v2; Owner: -
--

ALTER TABLE ONLY app_public_v2.gene
    ADD CONSTRAINT gene_pkey PRIMARY KEY (id);


--
-- Name: gene_set gene_set_pkey; Type: CONSTRAINT; Schema: app_public_v2; Owner: -
--

ALTER TABLE ONLY app_public_v2.gene_set
    ADD CONSTRAINT gene_set_pkey PRIMARY KEY (id);


--
-- Name: gene_set gene_set_term_key; Type: CONSTRAINT; Schema: app_public_v2; Owner: -
--

ALTER TABLE ONLY app_public_v2.gene_set
    ADD CONSTRAINT gene_set_term_key UNIQUE (term);


--
-- Name: gene gene_symbol_key; Type: CONSTRAINT; Schema: app_public_v2; Owner: -
--

ALTER TABLE ONLY app_public_v2.gene
    ADD CONSTRAINT gene_symbol_key UNIQUE (symbol);


--
-- Name: pmc_info pmc_info_pkey; Type: CONSTRAINT; Schema: app_public_v2; Owner: -
--

ALTER TABLE ONLY app_public_v2.pmc_info
    ADD CONSTRAINT pmc_info_pkey PRIMARY KEY (id);


--
-- Name: pmc_info pmc_info_pmcid_key; Type: CONSTRAINT; Schema: app_public_v2; Owner: -
--

ALTER TABLE ONLY app_public_v2.pmc_info
    ADD CONSTRAINT pmc_info_pmcid_key UNIQUE (pmcid);


--
-- Name: pmid_info pmid_info_pkey; Type: CONSTRAINT; Schema: app_public_v2; Owner: -
--

ALTER TABLE ONLY app_public_v2.pmid_info
    ADD CONSTRAINT pmid_info_pkey PRIMARY KEY (id);


--
-- Name: pmid_info pmid_info_pmid_key; Type: CONSTRAINT; Schema: app_public_v2; Owner: -
--

ALTER TABLE ONLY app_public_v2.pmid_info
    ADD CONSTRAINT pmid_info_pmid_key UNIQUE (pmid);


--
-- Name: release release_pkey; Type: CONSTRAINT; Schema: app_public_v2; Owner: -
--

ALTER TABLE ONLY app_public_v2.release
    ADD CONSTRAINT release_pkey PRIMARY KEY (id);


--
-- Name: user_gene_set user_gene_set_pkey; Type: CONSTRAINT; Schema: app_public_v2; Owner: -
--

ALTER TABLE ONLY app_public_v2.user_gene_set
    ADD CONSTRAINT user_gene_set_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: background_gene_ids_idx; Type: INDEX; Schema: app_public_v2; Owner: -
--

CREATE INDEX background_gene_ids_idx ON app_public_v2.background USING gin (gene_ids);


--
-- Name: gene_set_gene_ids_idx; Type: INDEX; Schema: app_public_v2; Owner: -
--

CREATE INDEX gene_set_gene_ids_idx ON app_public_v2.gene_set USING gin (gene_ids);


--
-- Name: gene_set_pmc_id_idx; Type: INDEX; Schema: app_public_v2; Owner: -
--

CREATE INDEX gene_set_pmc_id_idx ON app_public_v2.gene_set_pmc USING btree (id);


--
-- Name: gene_set_pmc_id_pmc_idx; Type: INDEX; Schema: app_public_v2; Owner: -
--

CREATE UNIQUE INDEX gene_set_pmc_id_pmc_idx ON app_public_v2.gene_set_pmc USING btree (id, pmc);


--
-- Name: gene_set_pmc_pmc_idx; Type: INDEX; Schema: app_public_v2; Owner: -
--

CREATE INDEX gene_set_pmc_pmc_idx ON app_public_v2.gene_set_pmc USING btree (pmc);


--
-- Name: gene_set_pmid_id_idx; Type: INDEX; Schema: app_public_v2; Owner: -
--

CREATE INDEX gene_set_pmid_id_idx ON app_public_v2.gene_set_pmid USING btree (id);


--
-- Name: gene_set_pmid_id_pmid_idx; Type: INDEX; Schema: app_public_v2; Owner: -
--

CREATE UNIQUE INDEX gene_set_pmid_id_pmid_idx ON app_public_v2.gene_set_pmid USING btree (id, pmid);


--
-- Name: gene_set_pmid_pmid_idx; Type: INDEX; Schema: app_public_v2; Owner: -
--

CREATE INDEX gene_set_pmid_pmid_idx ON app_public_v2.gene_set_pmid USING btree (pmid);


--
-- Name: gene_set_term_idx; Type: INDEX; Schema: app_public_v2; Owner: -
--

CREATE INDEX gene_set_term_idx ON app_public_v2.gene_set USING gin (term public.gin_trgm_ops);


--
-- Name: gene_synonyms_idx; Type: INDEX; Schema: app_public_v2; Owner: -
--

CREATE INDEX gene_synonyms_idx ON app_public_v2.gene USING gin (synonyms);


--
-- Name: release_created_idx; Type: INDEX; Schema: app_public_v2; Owner: -
--

CREATE INDEX release_created_idx ON app_public_v2.release USING btree (created);


--
-- PostgreSQL database dump complete
--


--
-- Dbmate schema migrations
--

INSERT INTO public.schema_migrations (version) VALUES
    ('20230906154745'),
    ('20230918153613'),
    ('20230920195024'),
    ('20230920201419'),
    ('20230925141013'),
    ('20230925165804'),
    ('20230925181844'),
    ('20231129200027');
