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
-- Name: app_public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA app_public;


--
-- Name: app_public_v2; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA app_public_v2;


--
-- Name: internal; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA internal;


--
-- Name: postgraphile_watch; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA postgraphile_watch;


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
-- Name: gene_set_library_enrich_result; Type: TYPE; Schema: app_public; Owner: -
--

CREATE TYPE app_public.gene_set_library_enrich_result AS (
	gene_set_id uuid,
	overlap_gene_ids uuid[],
	n_user_gene_ids bigint,
	n_gs_gene_ids bigint,
	n_background bigint,
	odds_ratio double precision,
	pvalue double precision,
	adj_pvalue double precision
);


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


--
-- Name: fishers_exact_result; Type: TYPE; Schema: internal; Owner: -
--

CREATE TYPE internal.fishers_exact_result AS (
	id uuid,
	pvalue double precision,
	adj_pvalue double precision
);


--
-- Name: overlap_result; Type: TYPE; Schema: internal; Owner: -
--

CREATE TYPE internal.overlap_result AS (
	gene_set_id uuid,
	overlap_gene_ids uuid[],
	n_user_gene_ids bigint,
	n_gs_gene_ids bigint,
	n_background bigint
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
-- Name: indexed_enrich(app_public_v2.background, uuid[], integer, double precision, double precision, integer, integer); Type: FUNCTION; Schema: app_private_v2; Owner: -
--

CREATE FUNCTION app_private_v2.indexed_enrich(background app_public_v2.background, gene_ids uuid[], overlap_ge integer DEFAULT 1, pvalue_le double precision DEFAULT 0.05, adj_pvalue_le double precision DEFAULT 0.05, "offset" integer DEFAULT 0, first integer DEFAULT 100) RETURNS app_public_v2.paginated_enrich_result
    LANGUAGE plpython3u IMMUTABLE STRICT PARALLEL SAFE
    AS $$
  import requests
  req = requests.post(
    f"http://enrich:8000/{background['id']}",
    params=dict(
      overlap_ge=overlap_ge,
      pvalue_le=pvalue_le,
      adj_pvalue_le=adj_pvalue_le,
      offset=offset,
      limit=first,
    ),
    json=gene_ids,
  )
  total_count = req.headers.get('Content-Range').partition('/')[-1]
  return dict(nodes=req.json(), total_count=total_count)
$$;


--
-- Name: user_gene_set; Type: TABLE; Schema: app_public; Owner: -
--

CREATE TABLE app_public.user_gene_set (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    genes character varying[],
    description character varying DEFAULT ''::character varying,
    created timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: add_user_gene_set(character varying[], character varying); Type: FUNCTION; Schema: app_public; Owner: -
--

CREATE FUNCTION app_public.add_user_gene_set(genes character varying[], description character varying DEFAULT ''::character varying) RETURNS app_public.user_gene_set
    LANGUAGE sql SECURITY DEFINER
    AS $$
  insert into app_public.user_gene_set (genes, description)
  select
    (
      select array_agg(ug.gene order by ug.gene)
      from unnest(add_user_gene_set.genes) ug(gene)
    ) as genes,
    add_user_gene_set.description
  returning *;
$$;


--
-- Name: gene; Type: TABLE; Schema: app_public; Owner: -
--

CREATE TABLE app_public.gene (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    symbol character varying NOT NULL
);


--
-- Name: gene_records_from_genes(character varying[]); Type: FUNCTION; Schema: app_public; Owner: -
--

CREATE FUNCTION app_public.gene_records_from_genes(genes character varying[]) RETURNS SETOF app_public.gene
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $$
  with cte as (
    select distinct coalesce(g.id, gs.gene_id) as gene_id
    from
      unnest(genes) ug(gene)
      left join app_public.gene g on g.symbol = ug.gene
      left join app_public.gene_synonym gs on gs.synonym = ug.gene
    where
      g.id is not null or gs.gene_id is not null
  )
  select distinct g.*
  from
    cte
    inner join app_public.gene g on g.id = cte.gene_id
  ;
$$;


--
-- Name: gene_set; Type: TABLE; Schema: app_public; Owner: -
--

CREATE TABLE app_public.gene_set (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    library_id uuid NOT NULL,
    term character varying NOT NULL
);


--
-- Name: gene_set_gene_search(character varying[]); Type: FUNCTION; Schema: app_public; Owner: -
--

CREATE FUNCTION app_public.gene_set_gene_search(genes character varying[]) RETURNS SETOF app_public.gene_set
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $$
  select distinct gs.*
  from
    app_public.gene_records_from_genes(genes) g
    inner join app_public.gene_set_gene gsg on gsg.gene_id = g.id
    inner join app_public.gene_set gs on gs.id = gsg.gene_set_id;
$$;


--
-- Name: gene_set_library; Type: TABLE; Schema: app_public; Owner: -
--

CREATE TABLE app_public.gene_set_library (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    description character varying NOT NULL,
    created timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: gene_set_library_background_genes(app_public.gene_set_library); Type: FUNCTION; Schema: app_public; Owner: -
--

CREATE FUNCTION app_public.gene_set_library_background_genes(gene_set_library app_public.gene_set_library) RETURNS SETOF app_public.gene
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    AS $$
  select g.*
  from app_public.gene_set_library_gene gslg
  inner join app_public.gene g on g.id = gslg.gene_id
  where gslg.library_id = gene_set_library.id;
$$;


--
-- Name: gene_set_library_enrich_fixed_background_size(app_public.gene_set_library, character varying[], bigint, bigint, double precision, double precision, double precision); Type: FUNCTION; Schema: app_public; Owner: -
--

CREATE FUNCTION app_public.gene_set_library_enrich_fixed_background_size(gene_set_library app_public.gene_set_library, genes character varying[], background_size bigint, overlap_greater_than bigint DEFAULT 0, fdr double precision DEFAULT 0.05, pvalue_less_than double precision DEFAULT 0.05, adj_pvalue_less_than double precision DEFAULT 0.05) RETURNS SETOF app_public.gene_set_library_enrich_result
    LANGUAGE sql IMMUTABLE STRICT SECURITY DEFINER PARALLEL SAFE
    AS $$
  with overlap as (
    select *
    from internal.gene_set_library_overlap_fixed_background_size(
      gene_set_library, genes, background_size, overlap_greater_than
    )
  ), vectorized as (
    select
      array_agg(o.gene_set_id) as ids,
      array_agg(array_length(o.overlap_gene_ids, 1)::bigint) as a,
      array_agg(o.n_user_gene_ids - array_length(o.overlap_gene_ids, 1)) as b,
      array_agg(o.n_gs_gene_ids - array_length(o.overlap_gene_ids, 1)) as c,
      array_agg(o.n_background - o.n_user_gene_ids - n_gs_gene_ids + array_length(o.overlap_gene_ids, 1)) as d,
      (
        select count(id)
        from app_public.gene_set gs
        where gs.library_id = gene_set_library.id
      ) as n
    from overlap o
  )
  select
    r.id as gene_set_id,
    o.overlap_gene_ids,
    o.n_user_gene_ids,
    o.n_gs_gene_ids,
    o.n_background,
    (
      array_length(o.overlap_gene_ids, 1)::double precision
      / nullif(o.n_user_gene_ids, 0)::double precision
    ) / nullif(
      o.n_gs_gene_ids::double precision
      / nullif(o.n_background, 0)::double precision, 0) as odds_ratio,
    r.pvalue,
    r.adj_pvalue
  from
    overlap o
    inner join (
      select r.*
      from vectorized, internal.fishers_exact(vectorized.ids, vectorized.a, vectorized.b, vectorized.c, vectorized.d, vectorized.n, fdr, pvalue_less_than, adj_pvalue_less_than) r
    ) r on o.gene_set_id = r.id
  order by r.pvalue asc
  ;
$$;


--
-- Name: gene_set_library_enrich_library_background(app_public.gene_set_library, character varying[], bigint, double precision, double precision, double precision); Type: FUNCTION; Schema: app_public; Owner: -
--

CREATE FUNCTION app_public.gene_set_library_enrich_library_background(gene_set_library app_public.gene_set_library, genes character varying[], overlap_greater_than bigint DEFAULT 0, fdr double precision DEFAULT 0.05, pvalue_less_than double precision DEFAULT 0.05, adj_pvalue_less_than double precision DEFAULT 0.05) RETURNS SETOF app_public.gene_set_library_enrich_result
    LANGUAGE sql IMMUTABLE STRICT SECURITY DEFINER PARALLEL SAFE
    AS $$
  with overlap as (
    select *
    from internal.gene_set_library_overlap_library_background(
      gene_set_library, genes, overlap_greater_than
    )
  ), vectorized as (
    select
      array_agg(o.gene_set_id) as ids,
      array_agg(array_length(o.overlap_gene_ids, 1)::bigint) as a,
      array_agg(o.n_user_gene_ids - array_length(o.overlap_gene_ids, 1)) as b,
      array_agg(o.n_gs_gene_ids - array_length(o.overlap_gene_ids, 1)) as c,
      array_agg(o.n_background - o.n_user_gene_ids - n_gs_gene_ids + array_length(o.overlap_gene_ids, 1)) as d,
      (
        select count(id)
        from app_public.gene_set gs
        where gs.library_id = gene_set_library.id
      ) as n
    from overlap o
  )
  select
    r.id as gene_set_id,
    o.overlap_gene_ids,
    o.n_user_gene_ids,
    o.n_gs_gene_ids,
    o.n_background,
    (
      array_length(o.overlap_gene_ids, 1)::double precision
      / nullif(o.n_user_gene_ids, 0)::double precision
    ) / nullif(
      o.n_gs_gene_ids::double precision
      / nullif(o.n_background, 0)::double precision, 0) as odds_ratio,
    r.pvalue,
    r.adj_pvalue
  from
    vectorized,
    internal.fishers_exact(vectorized.ids, vectorized.a, vectorized.b, vectorized.c, vectorized.d, vectorized.n, fdr, pvalue_less_than, adj_pvalue_less_than) r
    left join overlap o on o.gene_set_id = r.id
  ;
$$;


--
-- Name: gene_set_library_enrich_result_gene_set(app_public.gene_set_library_enrich_result); Type: FUNCTION; Schema: app_public; Owner: -
--

CREATE FUNCTION app_public.gene_set_library_enrich_result_gene_set(gene_set_library_enrich_result app_public.gene_set_library_enrich_result) RETURNS app_public.gene_set
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $$
  select *
  from app_public.gene_set gs
  where gs.id = gene_set_library_enrich_result.gene_set_id;
$$;


--
-- Name: gene_set_library_enrich_result_overlap_genes(app_public.gene_set_library_enrich_result); Type: FUNCTION; Schema: app_public; Owner: -
--

CREATE FUNCTION app_public.gene_set_library_enrich_result_overlap_genes(gene_set_library_enrich_result app_public.gene_set_library_enrich_result) RETURNS SETOF app_public.gene
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $$
  select g.*
  from unnest(gene_set_library_enrich_result.overlap_gene_ids) t(gene_id)
  inner join app_public.gene g on t.gene_id = g.id;
$$;


--
-- Name: gene_set_library_enrich_user_background(app_public.gene_set_library, character varying[], character varying[], bigint, double precision, double precision, double precision); Type: FUNCTION; Schema: app_public; Owner: -
--

CREATE FUNCTION app_public.gene_set_library_enrich_user_background(gene_set_library app_public.gene_set_library, genes character varying[], background_genes character varying[], overlap_greater_than bigint DEFAULT 0, fdr double precision DEFAULT 0.05, pvalue_less_than double precision DEFAULT 0.05, adj_pvalue_less_than double precision DEFAULT 0.05) RETURNS SETOF app_public.gene_set_library_enrich_result
    LANGUAGE sql IMMUTABLE STRICT SECURITY DEFINER PARALLEL SAFE
    AS $$
  with overlap as (
    select *
    from internal.gene_set_library_overlap_user_background(
      gene_set_library, genes, background_genes, overlap_greater_than
    )
  ), vectorized as (
    select
      array_agg(o.gene_set_id) as ids,
      array_agg(array_length(o.overlap_gene_ids, 1)::bigint) as a,
      array_agg(o.n_user_gene_ids - array_length(o.overlap_gene_ids, 1)) as b,
      array_agg(o.n_gs_gene_ids - array_length(o.overlap_gene_ids, 1)) as c,
      array_agg(o.n_background - o.n_user_gene_ids - n_gs_gene_ids + array_length(o.overlap_gene_ids, 1)) as d,
      (
        select count(id)
        from app_public.gene_set gs
        where gs.library_id = gene_set_library.id
      ) as n
    from overlap o
  )
  select
    r.id as gene_set_id,
    o.overlap_gene_ids,
    o.n_user_gene_ids,
    o.n_gs_gene_ids,
    o.n_background,
    (
      array_length(o.overlap_gene_ids, 1)::double precision
      / nullif(o.n_user_gene_ids, 0)::double precision
    ) / nullif(
      o.n_gs_gene_ids::double precision
      / nullif(o.n_background, 0)::double precision, 0) as odds_ratio,
    r.pvalue,
    r.adj_pvalue
  from
    vectorized,
    internal.fishers_exact(vectorized.ids, vectorized.a, vectorized.b, vectorized.c, vectorized.d, vectorized.n, fdr, pvalue_less_than, adj_pvalue_less_than) r
    left join overlap o on o.gene_set_id = r.id
  ;
$$;


--
-- Name: gene_set_library_gene_search(app_public.gene_set_library, character varying[]); Type: FUNCTION; Schema: app_public; Owner: -
--

CREATE FUNCTION app_public.gene_set_library_gene_search(gene_set_library app_public.gene_set_library, genes character varying[]) RETURNS SETOF app_public.gene_set
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $$
  select distinct gs.*
  from
    app_public.gene_records_from_genes(genes) g
    inner join app_public.gene_set_gene gsg on gsg.gene_id = g.id
    inner join app_public.gene_set gs on gs.id = gsg.gene_set_id
  where
    gs.library_id = gene_set_library.id;
$$;


--
-- Name: gene_set_library_term_search(app_public.gene_set_library, character varying[]); Type: FUNCTION; Schema: app_public; Owner: -
--

CREATE FUNCTION app_public.gene_set_library_term_search(gene_set_library app_public.gene_set_library, terms character varying[]) RETURNS SETOF app_public.gene_set
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $$
  select distinct gs.*
  from
    app_public.gene_set gs
    inner join unnest(terms) ut(term) on gs.term ilike ('%' || ut.term || '%')
  where
    gs.library_id = gene_set_library.id;
$$;


--
-- Name: gene_set_library_term_search_count(app_public.gene_set_library, character varying[]); Type: FUNCTION; Schema: app_public; Owner: -
--

CREATE FUNCTION app_public.gene_set_library_term_search_count(gene_set_library app_public.gene_set_library, terms character varying[]) RETURNS TABLE(id uuid, term character varying, count integer)
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $$
  select distinct gs.id, gs.term, gsl.count
  from
    app_public.gene_set gs
    inner join unnest(terms) ut(term) on gs.term ilike ('%' || ut.term || '%')
    inner join app_public.gene_set_length gsl on gsl.id = gs.id
  where
    gs.library_id = gene_set_library.id;
$$;


--
-- Name: gene_set_library_terms_pmcs_count(app_public.gene_set_library, character varying[]); Type: FUNCTION; Schema: app_public; Owner: -
--

CREATE FUNCTION app_public.gene_set_library_terms_pmcs_count(gene_set_library app_public.gene_set_library, pmcids character varying[]) RETURNS TABLE(pmc character varying, term character varying, id uuid, count integer)
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $$
  select gsp.pmc, gs.term, gs.id, gsl.count
  from
    app_public.gene_set_pmc as gsp
    inner join app_public.gene_set as gs on gs.id = gsp.id
    inner join app_public.gene_set_length as gsl on gsl.id = gsp.id
  where
    gsp.pmc = ANY (pmcids) and
    gs.library_id = gene_set_library.id;
$$;


--
-- Name: gene_set_term_search(character varying[]); Type: FUNCTION; Schema: app_public; Owner: -
--

CREATE FUNCTION app_public.gene_set_term_search(terms character varying[]) RETURNS SETOF app_public.gene_set
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $$
  select gs.*
  from app_public.gene_set gs
  inner join unnest(terms) ut(term) on gs.term ilike ('%' || ut.term || '%');
$$;


--
-- Name: gene_set_term_search_count(character varying[]); Type: FUNCTION; Schema: app_public; Owner: -
--

CREATE FUNCTION app_public.gene_set_term_search_count(terms character varying[]) RETURNS TABLE(id uuid, term character varying, count integer)
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $$
  select gs.id, gs.term, gsl.count
  from app_public.gene_set gs
  inner join unnest(terms) ut(term) on gs.term ilike ('%' || ut.term || '%')
  inner join app_public.gene_set_length gsl on gsl.id = gs.id;
$$;


--
-- Name: terms_pmcs_count(character varying[]); Type: FUNCTION; Schema: app_public; Owner: -
--

CREATE FUNCTION app_public.terms_pmcs_count(pmcids character varying[]) RETURNS TABLE(pmc character varying, term character varying, id uuid, count integer)
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $$
  select gsp.pmc, gs.term, gs.id, gsl.count
  from
    app_public.gene_set_pmc as gsp
    inner join app_public.gene_set as gs on gs.id = gsp.id
    inner join app_public.gene_set_length as gsl on gsl.id = gsp.id
  where gsp.pmc = ANY (pmcids);
$$;


--
-- Name: view_gene_set(uuid); Type: FUNCTION; Schema: app_public; Owner: -
--

CREATE FUNCTION app_public.view_gene_set(gsid uuid) RETURNS TABLE(symbol character varying)
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $$
  select g.symbol
  from
    app_public.gene g
    inner join app_public.gene_set_gene as gsg on g.id = gsg.gene_id
  where gsg.gene_set_id = gsid;
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
-- Name: background_enrich(app_public_v2.background, character varying[], integer, double precision, double precision, integer, integer); Type: FUNCTION; Schema: app_public_v2; Owner: -
--

CREATE FUNCTION app_public_v2.background_enrich(background app_public_v2.background, genes character varying[], overlap_ge integer DEFAULT 1, pvalue_le double precision DEFAULT 0.05, adj_pvalue_le double precision DEFAULT 0.05, "offset" integer DEFAULT 0, first integer DEFAULT 100) RETURNS app_public_v2.paginated_enrich_result
    LANGUAGE sql IMMUTABLE STRICT SECURITY DEFINER PARALLEL SAFE
    AS $$
  select r.*
  from app_private_v2.indexed_enrich(
    background_enrich.background,
    (select array_agg(gene_id) from app_public_v2.gene_map(genes) gm),
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
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
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
-- Name: gene_id_map_from_genes(character varying[]); Type: FUNCTION; Schema: internal; Owner: -
--

CREATE FUNCTION internal.gene_id_map_from_genes(genes character varying[]) RETURNS jsonb
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $$
  select coalesce(
    jsonb_object_agg(ug.gene, coalesce(g.id, gs.gene_id)),
    '{}'::jsonb
  )
  from
    unnest(genes) ug(gene)
    left join app_public.gene g on g.symbol = ug.gene
    left join app_public.gene_synonym gs on gs.synonym = ug.gene
  where
    g.id is not null or gs.gene_id is not null
  ;
$$;


--
-- Name: gene_set_library_overlap_fixed_background_size(app_public.gene_set_library, character varying[], bigint, bigint); Type: FUNCTION; Schema: internal; Owner: -
--

CREATE FUNCTION internal.gene_set_library_overlap_fixed_background_size(gene_set_library app_public.gene_set_library, genes character varying[], background_size bigint DEFAULT 20000, overlap_greater_than bigint DEFAULT 0) RETURNS SETOF internal.overlap_result
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $$
  select
    gs.id as gene_set_id,
    array_agg(gsg.gene_id) as overlap_gene_ids,
    (
      select count(ug_.id)
      from app_public.gene_records_from_genes(gene_set_library_overlap_fixed_background_size.genes) ug_
    ) as n_user_gene_ids,
    (
      select count(gsg_.gene_id)
      from app_public.gene_set_gene gsg_
      where gsg_.gene_set_id = gs.id
    ) as n_gs_gene_ids,
    gene_set_library_overlap_fixed_background_size.background_size
  from
    app_public.gene_records_from_genes(gene_set_library_overlap_fixed_background_size.genes) ug
    inner join app_public.gene_set_gene gsg on ug.id = gsg.gene_id
    inner join app_public.gene_set gs on gsg.gene_set_id = gs.id
  where
    gs.library_id = gene_set_library_overlap_fixed_background_size.gene_set_library.id
  group by gs.id
  having count(gsg.gene_id) > gene_set_library_overlap_fixed_background_size.overlap_greater_than
  order by count(gsg.gene_id) desc;
$$;


--
-- Name: gene_set_library_overlap_library_background(app_public.gene_set_library, character varying[], bigint); Type: FUNCTION; Schema: internal; Owner: -
--

CREATE FUNCTION internal.gene_set_library_overlap_library_background(gene_set_library app_public.gene_set_library, genes character varying[], overlap_greater_than bigint DEFAULT 0) RETURNS SETOF internal.overlap_result
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $$
  select
    gs.id as gene_set_id,
    array_agg(gsg.gene_id) as overlap_gene_ids,
    (
      select count(ug_.id)
      from app_public.gene_records_from_genes(gene_set_library_overlap_library_background.genes) ug_
      inner join app_public.gene_set_library_background_genes(gene_set_library_overlap_library_background.gene_set_library) gsbg_ on gsbg_.id = ug_.id
    ) as n_user_gene_ids,
    (
      select count(gsg_.gene_id)
      from app_public.gene_set_gene gsg_
      where gsg_.gene_set_id = gs.id
    ) as n_gs_gene_ids,
    (
      select count(gsbg_.id)
      from app_public.gene_set_library_background_genes(gene_set_library_overlap_library_background.gene_set_library) gsbg_
    ) as n_background
  from
    app_public.gene_records_from_genes(gene_set_library_overlap_library_background.genes) ug
    inner join app_public.gene_set_library_background_genes(gene_set_library_overlap_library_background.gene_set_library) gsbg on gsbg.id = ug.id
    inner join app_public.gene_set_gene gsg on ug.id = gsg.gene_id
    inner join app_public.gene_set gs on gsg.gene_set_id = gs.id
  where
    gs.library_id = gene_set_library_overlap_library_background.gene_set_library.id
  group by gs.id
  having count(gsg.gene_id) > gene_set_library_overlap_library_background.overlap_greater_than
  order by count(gsg.gene_id) desc;
$$;


--
-- Name: gene_set_library_overlap_user_background(app_public.gene_set_library, character varying[], character varying[], bigint); Type: FUNCTION; Schema: internal; Owner: -
--

CREATE FUNCTION internal.gene_set_library_overlap_user_background(gene_set_library app_public.gene_set_library, genes character varying[], background_genes character varying[], overlap_greater_than bigint DEFAULT 0) RETURNS SETOF internal.overlap_result
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $$
  select
    gs.id as gene_set_id,
    array_agg(gsg.gene_id) as overlap_gene_ids,
    (
      select count(ug_.id)
      from app_public.gene_records_from_genes(gene_set_library_overlap_user_background.genes) ug_
      inner join app_public.gene_records_from_genes(gene_set_library_overlap_user_background.background_genes) bg_ on bg_.id = ug_.id
      inner join app_public.gene_set_library_background_genes(gene_set_library_overlap_user_background.gene_set_library) gsbg_ on gsbg_.id = ug_.id
    ) as n_user_gene_ids,
    (
      select count(gsg_.gene_id)
      from app_public.gene_set_gene gsg_
      inner join app_public.gene_records_from_genes(gene_set_library_overlap_user_background.background_genes) bg_ on bg_.id = gsg_.gene_id
      where gsg_.gene_set_id = gs.id
    ) as n_gs_gene_ids,
    (
      select count(gsbg_.id)
      from app_public.gene_set_library_background_genes(gene_set_library_overlap_user_background.gene_set_library) gsbg_
      inner join app_public.gene_records_from_genes(gene_set_library_overlap_user_background.background_genes) bg_ on bg_.id = gsbg_.id
    ) as n_background
  from
    app_public.gene_records_from_genes(gene_set_library_overlap_user_background.genes) ug
    inner join app_public.gene_records_from_genes(gene_set_library_overlap_user_background.background_genes) ubg on ubg.id = ug.id
    inner join app_public.gene_set_library_background_genes(gene_set_library_overlap_user_background.gene_set_library) gsbg on gsbg.id = ug.id
    inner join app_public.gene_set_gene gsg on ug.id = gsg.gene_id
    inner join app_public.gene_set gs on gsg.gene_set_id = gs.id
  where
    gs.library_id = gene_set_library_overlap_user_background.gene_set_library.id
  group by gs.id
  having count(gsg.gene_id) > gene_set_library_overlap_user_background.overlap_greater_than
  order by count(gsg.gene_id) desc;
$$;


--
-- Name: notify_watchers_ddl(); Type: FUNCTION; Schema: postgraphile_watch; Owner: -
--

CREATE FUNCTION postgraphile_watch.notify_watchers_ddl() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
begin
  perform pg_notify(
    'postgraphile_watch',
    json_build_object(
      'type',
      'ddl',
      'payload',
      (select json_agg(json_build_object('schema', schema_name, 'command', command_tag)) from pg_event_trigger_ddl_commands() as x)
    )::text
  );
end;
$$;


--
-- Name: notify_watchers_drop(); Type: FUNCTION; Schema: postgraphile_watch; Owner: -
--

CREATE FUNCTION postgraphile_watch.notify_watchers_drop() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
begin
  perform pg_notify(
    'postgraphile_watch',
    json_build_object(
      'type',
      'drop',
      'payload',
      (select json_agg(distinct x.schema_name) from pg_event_trigger_dropped_objects() as x)
    )::text
  );
end;
$$;


--
-- Name: gene_set_gene; Type: TABLE; Schema: app_public; Owner: -
--

CREATE TABLE app_public.gene_set_gene (
    gene_set_id uuid NOT NULL,
    gene_id uuid NOT NULL
);


--
-- Name: gene_set_length; Type: MATERIALIZED VIEW; Schema: app_public; Owner: -
--

CREATE MATERIALIZED VIEW app_public.gene_set_length AS
 SELECT gsg.gene_set_id AS id,
    count(*) AS count
   FROM app_public.gene_set_gene gsg
  GROUP BY gsg.gene_set_id
  WITH NO DATA;


--
-- Name: MATERIALIZED VIEW gene_set_length; Type: COMMENT; Schema: app_public; Owner: -
--

COMMENT ON MATERIALIZED VIEW app_public.gene_set_length IS '@foreignKey (id) references app_public.gene_set (id)';


--
-- Name: gene_set_library_gene; Type: MATERIALIZED VIEW; Schema: app_public; Owner: -
--

CREATE MATERIALIZED VIEW app_public.gene_set_library_gene AS
 SELECT DISTINCT gsl.id AS library_id,
    gsg.gene_id
   FROM ((app_public.gene_set_library gsl
     JOIN app_public.gene_set gs ON ((gs.library_id = gsl.id)))
     JOIN app_public.gene_set_gene gsg ON ((gsg.gene_set_id = gs.id)))
  WITH NO DATA;


--
-- Name: MATERIALIZED VIEW gene_set_library_gene; Type: COMMENT; Schema: app_public; Owner: -
--

COMMENT ON MATERIALIZED VIEW app_public.gene_set_library_gene IS '@foreignKey (library_id) references app_public.gene_set_library (id)
@foreignKey (gene_id) references app_public.gene (id)';


--
-- Name: gene_set_pmc; Type: MATERIALIZED VIEW; Schema: app_public; Owner: -
--

CREATE MATERIALIZED VIEW app_public.gene_set_pmc AS
 SELECT gs.id,
    regexp_replace((gs.term)::text, '^(^PMC\d+)(.*)$'::text, '\1'::text) AS pmc
   FROM app_public.gene_set gs
  WITH NO DATA;


--
-- Name: MATERIALIZED VIEW gene_set_pmc; Type: COMMENT; Schema: app_public; Owner: -
--

COMMENT ON MATERIALIZED VIEW app_public.gene_set_pmc IS '@foreignKey (id) references app_public.gene_set (id)';


--
-- Name: gene_synonym; Type: TABLE; Schema: app_public; Owner: -
--

CREATE TABLE app_public.gene_synonym (
    gene_id uuid NOT NULL,
    synonym character varying NOT NULL
);


--
-- Name: pmc; Type: VIEW; Schema: app_public; Owner: -
--

CREATE VIEW app_public.pmc AS
 SELECT DISTINCT gene_set_pmc.pmc
   FROM app_public.gene_set_pmc;


--
-- Name: VIEW pmc; Type: COMMENT; Schema: app_public; Owner: -
--

COMMENT ON VIEW app_public.pmc IS '@foreignKey (pmc) references app_public.gene_set_pmc (pmc)';


--
-- Name: pmc_info; Type: TABLE; Schema: app_public; Owner: -
--

CREATE TABLE app_public.pmc_info (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    pmcid character varying NOT NULL,
    title character varying,
    yr integer,
    doi character varying
);


--
-- Name: TABLE pmc_info; Type: COMMENT; Schema: app_public; Owner: -
--

COMMENT ON TABLE app_public.pmc_info IS '@foreignKey (pmcid) references app_public.gene_set_pmc (pmc)';


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
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version character varying(128) NOT NULL
);


--
-- Name: gene gene_pkey; Type: CONSTRAINT; Schema: app_public; Owner: -
--

ALTER TABLE ONLY app_public.gene
    ADD CONSTRAINT gene_pkey PRIMARY KEY (id);


--
-- Name: gene_set_gene gene_set_gene_pkey; Type: CONSTRAINT; Schema: app_public; Owner: -
--

ALTER TABLE ONLY app_public.gene_set_gene
    ADD CONSTRAINT gene_set_gene_pkey PRIMARY KEY (gene_set_id, gene_id);


--
-- Name: gene_set gene_set_library_id_term_key; Type: CONSTRAINT; Schema: app_public; Owner: -
--

ALTER TABLE ONLY app_public.gene_set
    ADD CONSTRAINT gene_set_library_id_term_key UNIQUE (library_id, term);


--
-- Name: gene_set_library gene_set_library_name_key; Type: CONSTRAINT; Schema: app_public; Owner: -
--

ALTER TABLE ONLY app_public.gene_set_library
    ADD CONSTRAINT gene_set_library_name_key UNIQUE (name);


--
-- Name: gene_set_library gene_set_library_pkey; Type: CONSTRAINT; Schema: app_public; Owner: -
--

ALTER TABLE ONLY app_public.gene_set_library
    ADD CONSTRAINT gene_set_library_pkey PRIMARY KEY (id);


--
-- Name: gene_set gene_set_pkey; Type: CONSTRAINT; Schema: app_public; Owner: -
--

ALTER TABLE ONLY app_public.gene_set
    ADD CONSTRAINT gene_set_pkey PRIMARY KEY (id);


--
-- Name: gene gene_symbol_key; Type: CONSTRAINT; Schema: app_public; Owner: -
--

ALTER TABLE ONLY app_public.gene
    ADD CONSTRAINT gene_symbol_key UNIQUE (symbol);


--
-- Name: gene_synonym gene_synonym_pkey; Type: CONSTRAINT; Schema: app_public; Owner: -
--

ALTER TABLE ONLY app_public.gene_synonym
    ADD CONSTRAINT gene_synonym_pkey PRIMARY KEY (gene_id, synonym);


--
-- Name: gene_synonym gene_synonym_synonym_key; Type: CONSTRAINT; Schema: app_public; Owner: -
--

ALTER TABLE ONLY app_public.gene_synonym
    ADD CONSTRAINT gene_synonym_synonym_key UNIQUE (synonym);


--
-- Name: pmc_info pmc_info_pkey; Type: CONSTRAINT; Schema: app_public; Owner: -
--

ALTER TABLE ONLY app_public.pmc_info
    ADD CONSTRAINT pmc_info_pkey PRIMARY KEY (id);


--
-- Name: pmc_info pmc_info_pmcid_key; Type: CONSTRAINT; Schema: app_public; Owner: -
--

ALTER TABLE ONLY app_public.pmc_info
    ADD CONSTRAINT pmc_info_pmcid_key UNIQUE (pmcid);


--
-- Name: user_gene_set user_gene_set_pkey; Type: CONSTRAINT; Schema: app_public; Owner: -
--

ALTER TABLE ONLY app_public.user_gene_set
    ADD CONSTRAINT user_gene_set_pkey PRIMARY KEY (id);


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
-- Name: gene_set_gene_id_idx; Type: INDEX; Schema: app_public; Owner: -
--

CREATE INDEX gene_set_gene_id_idx ON app_public.gene_set_gene USING btree (gene_id);


--
-- Name: gene_set_gene_set_id_idx; Type: INDEX; Schema: app_public; Owner: -
--

CREATE INDEX gene_set_gene_set_id_idx ON app_public.gene_set_gene USING btree (gene_set_id);


--
-- Name: gene_set_library_gene_gene_id_idx; Type: INDEX; Schema: app_public; Owner: -
--

CREATE INDEX gene_set_library_gene_gene_id_idx ON app_public.gene_set_library_gene USING btree (gene_id);


--
-- Name: gene_set_library_gene_library_id_gene_id_idx; Type: INDEX; Schema: app_public; Owner: -
--

CREATE UNIQUE INDEX gene_set_library_gene_library_id_gene_id_idx ON app_public.gene_set_library_gene USING btree (library_id, gene_id);


--
-- Name: gene_set_library_gene_library_id_idx; Type: INDEX; Schema: app_public; Owner: -
--

CREATE INDEX gene_set_library_gene_library_id_idx ON app_public.gene_set_library_gene USING btree (library_id);


--
-- Name: gene_set_library_id_idx; Type: INDEX; Schema: app_public; Owner: -
--

CREATE INDEX gene_set_library_id_idx ON app_public.gene_set USING btree (library_id);


--
-- Name: gene_set_pmc_id; Type: INDEX; Schema: app_public; Owner: -
--

CREATE INDEX gene_set_pmc_id ON app_public.gene_set_pmc USING btree (id);


--
-- Name: gene_set_pmc_id_idx; Type: INDEX; Schema: app_public; Owner: -
--

CREATE INDEX gene_set_pmc_id_idx ON app_public.gene_set_pmc USING btree (id);


--
-- Name: gene_set_pmc_id_pmc_idx; Type: INDEX; Schema: app_public; Owner: -
--

CREATE UNIQUE INDEX gene_set_pmc_id_pmc_idx ON app_public.gene_set_pmc USING btree (id, pmc);


--
-- Name: gene_set_pmc_pmc_idx; Type: INDEX; Schema: app_public; Owner: -
--

CREATE INDEX gene_set_pmc_pmc_idx ON app_public.gene_set_pmc USING btree (pmc);


--
-- Name: gene_set_term_idx; Type: INDEX; Schema: app_public; Owner: -
--

CREATE INDEX gene_set_term_idx ON app_public.gene_set USING btree (term);


--
-- Name: gene_synonym_gene_id_idx; Type: INDEX; Schema: app_public; Owner: -
--

CREATE INDEX gene_synonym_gene_id_idx ON app_public.gene_synonym USING btree (gene_id);


--
-- Name: idx_gene_set_length; Type: INDEX; Schema: app_public; Owner: -
--

CREATE INDEX idx_gene_set_length ON app_public.gene_set_length USING btree (id);


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
-- Name: gene_set_term_idx; Type: INDEX; Schema: app_public_v2; Owner: -
--

CREATE INDEX gene_set_term_idx ON app_public_v2.gene_set USING gin (term public.gin_trgm_ops);


--
-- Name: gene_synonyms_idx; Type: INDEX; Schema: app_public_v2; Owner: -
--

CREATE INDEX gene_synonyms_idx ON app_public_v2.gene USING gin (synonyms);


--
-- Name: gene_set_gene gene_set_gene_gene_id_fkey; Type: FK CONSTRAINT; Schema: app_public; Owner: -
--

ALTER TABLE ONLY app_public.gene_set_gene
    ADD CONSTRAINT gene_set_gene_gene_id_fkey FOREIGN KEY (gene_id) REFERENCES app_public.gene(id) ON DELETE CASCADE;


--
-- Name: gene_set_gene gene_set_gene_gene_set_id_fkey; Type: FK CONSTRAINT; Schema: app_public; Owner: -
--

ALTER TABLE ONLY app_public.gene_set_gene
    ADD CONSTRAINT gene_set_gene_gene_set_id_fkey FOREIGN KEY (gene_set_id) REFERENCES app_public.gene_set(id) ON DELETE CASCADE;


--
-- Name: gene_set gene_set_library_id_fkey; Type: FK CONSTRAINT; Schema: app_public; Owner: -
--

ALTER TABLE ONLY app_public.gene_set
    ADD CONSTRAINT gene_set_library_id_fkey FOREIGN KEY (library_id) REFERENCES app_public.gene_set_library(id) ON DELETE CASCADE;


--
-- Name: gene_synonym gene_synonym_gene_id_fkey; Type: FK CONSTRAINT; Schema: app_public; Owner: -
--

ALTER TABLE ONLY app_public.gene_synonym
    ADD CONSTRAINT gene_synonym_gene_id_fkey FOREIGN KEY (gene_id) REFERENCES app_public.gene(id);


--
-- Name: postgraphile_watch_ddl; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER postgraphile_watch_ddl ON ddl_command_end
         WHEN TAG IN ('ALTER AGGREGATE', 'ALTER DOMAIN', 'ALTER EXTENSION', 'ALTER FOREIGN TABLE', 'ALTER FUNCTION', 'ALTER POLICY', 'ALTER SCHEMA', 'ALTER TABLE', 'ALTER TYPE', 'ALTER VIEW', 'COMMENT', 'CREATE AGGREGATE', 'CREATE DOMAIN', 'CREATE EXTENSION', 'CREATE FOREIGN TABLE', 'CREATE FUNCTION', 'CREATE INDEX', 'CREATE POLICY', 'CREATE RULE', 'CREATE SCHEMA', 'CREATE TABLE', 'CREATE TABLE AS', 'CREATE VIEW', 'DROP AGGREGATE', 'DROP DOMAIN', 'DROP EXTENSION', 'DROP FOREIGN TABLE', 'DROP FUNCTION', 'DROP INDEX', 'DROP OWNED', 'DROP POLICY', 'DROP RULE', 'DROP SCHEMA', 'DROP TABLE', 'DROP TYPE', 'DROP VIEW', 'GRANT', 'REVOKE', 'SELECT INTO')
   EXECUTE FUNCTION postgraphile_watch.notify_watchers_ddl();


--
-- Name: postgraphile_watch_drop; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER postgraphile_watch_drop ON sql_drop
   EXECUTE FUNCTION postgraphile_watch.notify_watchers_drop();


--
-- PostgreSQL database dump complete
--


--
-- Dbmate schema migrations
--

INSERT INTO public.schema_migrations (version) VALUES
    ('20230729193513'),
    ('20230828144957'),
    ('20230830165721'),
    ('20230830171356'),
    ('20230830210011'),
    ('20230906154745'),
    ('20230918153613'),
    ('20230920195024'),
    ('20230920201419');
