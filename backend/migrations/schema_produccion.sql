-- My Teacher IA - PostgreSQL 17
-- Solo estructura de las tablas conauti_.
-- No incluye usuarios ni conversaciones.
-- Restauracion aislada: verificada.
-- Utilizar solo en una base nueva y vacia.

--
-- PostgreSQL database dump
--

\restrict RzLEFdYV7cPOSmDVg4HfNTbOL4Ba8E40bvKoDi9JRcgzOjSLYBITM9yTc0tn38x

-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: conauti_default_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.conauti_default_role() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO conauti_user_roles(user_id, role_code)
  VALUES (NEW.id, 'student');

  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: conauti_ai_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conauti_ai_requests (
    request_id uuid NOT NULL,
    user_id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    prompt_hash character(64) NOT NULL,
    user_message_id bigint NOT NULL,
    assistant_message_id bigint NOT NULL,
    provider character varying(32) NOT NULL,
    model character varying(100) NOT NULL,
    input_tokens integer DEFAULT 0 NOT NULL,
    output_tokens integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: conauti_assessment_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conauti_assessment_attempts (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    topic_key character varying(120) NOT NULL,
    exercise_key character varying(20) NOT NULL,
    selected_option character varying(1),
    correct boolean,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    answered_at timestamp with time zone,
    CONSTRAINT ck_conauti_attempt_state CHECK ((((answered_at IS NULL) AND (selected_option IS NULL) AND (correct IS NULL)) OR ((answered_at IS NOT NULL) AND (selected_option IS NOT NULL) AND (correct IS NOT NULL)))),
    CONSTRAINT conauti_assessment_attempts_selected_option_check CHECK (((selected_option)::text = ANY ((ARRAY['A'::character varying, 'B'::character varying, 'C'::character varying, 'D'::character varying])::text[])))
);


--
-- Name: conauti_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conauti_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title character varying(120) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: conauti_learning_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conauti_learning_profiles (
    user_id uuid NOT NULL,
    explanation_style character varying(20) DEFAULT 'adaptativo'::character varying NOT NULL,
    difficulty character varying(20) DEFAULT 'adaptativa'::character varying NOT NULL,
    learning_goal character varying(160) DEFAULT ''::character varying NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT conauti_learning_profiles_difficulty_check CHECK (((difficulty)::text = ANY ((ARRAY['adaptativa'::character varying, 'basica'::character varying, 'intermedia'::character varying, 'avanzada'::character varying])::text[]))),
    CONSTRAINT conauti_learning_profiles_explanation_style_check CHECK (((explanation_style)::text = ANY ((ARRAY['adaptativo'::character varying, 'paso_a_paso'::character varying, 'visual'::character varying, 'ejemplos'::character varying])::text[])))
);


--
-- Name: conauti_learning_topics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conauti_learning_topics (
    user_id uuid NOT NULL,
    topic_key character varying(120) NOT NULL,
    topic character varying(120) NOT NULL,
    mastery smallint NOT NULL,
    last_difficulty character varying(180) DEFAULT ''::character varying NOT NULL,
    next_goal character varying(180) DEFAULT ''::character varying NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT conauti_learning_topics_mastery_check CHECK (((mastery >= 0) AND (mastery <= 4)))
);


--
-- Name: conauti_memories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conauti_memories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    content text NOT NULL,
    source_message_id bigint,
    consent_granted_at timestamp with time zone,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: conauti_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conauti_messages (
    id bigint NOT NULL,
    conversation_id uuid NOT NULL,
    role character varying(16) NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT conauti_messages_role_check CHECK (((role)::text = ANY (ARRAY[('user'::character varying)::text, ('assistant'::character varying)::text])))
);


--
-- Name: conauti_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.conauti_messages ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.conauti_messages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: conauti_pedagogy_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conauti_pedagogy_events (
    message_id bigint NOT NULL,
    conversation_id uuid NOT NULL,
    intent character varying(32) NOT NULL,
    hint_level integer NOT NULL,
    no_hints boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: conauti_pedagogy_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conauti_pedagogy_state (
    conversation_id uuid NOT NULL,
    hint_level integer DEFAULT 0 NOT NULL,
    no_hints boolean DEFAULT false NOT NULL,
    last_intent character varying(32) DEFAULT 'concept'::character varying NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT conauti_pedagogy_state_hint_level_check CHECK (((hint_level >= 0) AND (hint_level <= 3)))
);


--
-- Name: conauti_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conauti_progress (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    subject character varying(100) NOT NULL,
    topic character varying(150) NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    score numeric(5,2),
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT conauti_progress_attempts_check CHECK ((attempts >= 0)),
    CONSTRAINT conauti_progress_score_check CHECK (((score >= (0)::numeric) AND (score <= (100)::numeric)))
);


--
-- Name: conauti_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conauti_roles (
    code character varying(16) NOT NULL,
    description text NOT NULL,
    CONSTRAINT conauti_roles_code_valid CHECK (((code)::text = ANY (ARRAY[('student'::character varying)::text, ('teacher'::character varying)::text, ('admin'::character varying)::text])))
);


--
-- Name: conauti_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conauti_sessions (
    token_hash text NOT NULL,
    user_id uuid NOT NULL,
    expires_at timestamp with time zone NOT NULL
);


--
-- Name: conauti_user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conauti_user_roles (
    user_id uuid NOT NULL,
    role_code character varying(16) NOT NULL
);


--
-- Name: conauti_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conauti_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    username character varying(32) NOT NULL,
    password_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: conauti_voice_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conauti_voice_preferences (
    user_id uuid NOT NULL,
    voice_id character varying(20) DEFAULT 'ef_dora'::character varying NOT NULL,
    speed numeric(4,2) DEFAULT 1.00 NOT NULL,
    volume numeric(4,2) DEFAULT 1.00 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT conauti_voice_preferences_speed_check CHECK (((speed >= 0.75) AND (speed <= 1.25))),
    CONSTRAINT conauti_voice_preferences_voice_id_check CHECK (((voice_id)::text = ANY ((ARRAY['ef_dora'::character varying, 'em_alex'::character varying, 'em_santa'::character varying])::text[]))),
    CONSTRAINT conauti_voice_preferences_volume_check CHECK (((volume >= (0)::numeric) AND (volume <= (1)::numeric)))
);


--
-- Name: conauti_voice_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conauti_voice_usage (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    audio_bytes integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT conauti_voice_usage_audio_bytes_check CHECK ((audio_bytes > 0))
);


--
-- Name: conauti_voice_usage_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.conauti_voice_usage_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: conauti_voice_usage_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.conauti_voice_usage_id_seq OWNED BY public.conauti_voice_usage.id;


--
-- Name: conauti_voice_usage id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conauti_voice_usage ALTER COLUMN id SET DEFAULT nextval('public.conauti_voice_usage_id_seq'::regclass);


--
-- Name: conauti_ai_requests conauti_ai_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conauti_ai_requests
    ADD CONSTRAINT conauti_ai_requests_pkey PRIMARY KEY (request_id);


--
-- Name: conauti_assessment_attempts conauti_assessment_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conauti_assessment_attempts
    ADD CONSTRAINT conauti_assessment_attempts_pkey PRIMARY KEY (id);


--
-- Name: conauti_conversations conauti_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conauti_conversations
    ADD CONSTRAINT conauti_conversations_pkey PRIMARY KEY (id);


--
-- Name: conauti_learning_profiles conauti_learning_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conauti_learning_profiles
    ADD CONSTRAINT conauti_learning_profiles_pkey PRIMARY KEY (user_id);


--
-- Name: conauti_learning_topics conauti_learning_topics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conauti_learning_topics
    ADD CONSTRAINT conauti_learning_topics_pkey PRIMARY KEY (user_id, topic_key);


--
-- Name: conauti_memories conauti_memories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conauti_memories
    ADD CONSTRAINT conauti_memories_pkey PRIMARY KEY (id);


--
-- Name: conauti_messages conauti_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conauti_messages
    ADD CONSTRAINT conauti_messages_pkey PRIMARY KEY (id);


--
-- Name: conauti_pedagogy_events conauti_pedagogy_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conauti_pedagogy_events
    ADD CONSTRAINT conauti_pedagogy_events_pkey PRIMARY KEY (message_id);


--
-- Name: conauti_pedagogy_state conauti_pedagogy_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conauti_pedagogy_state
    ADD CONSTRAINT conauti_pedagogy_state_pkey PRIMARY KEY (conversation_id);


--
-- Name: conauti_progress conauti_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conauti_progress
    ADD CONSTRAINT conauti_progress_pkey PRIMARY KEY (id);


--
-- Name: conauti_roles conauti_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conauti_roles
    ADD CONSTRAINT conauti_roles_pkey PRIMARY KEY (code);


--
-- Name: conauti_sessions conauti_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conauti_sessions
    ADD CONSTRAINT conauti_sessions_pkey PRIMARY KEY (token_hash);


--
-- Name: conauti_user_roles conauti_user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conauti_user_roles
    ADD CONSTRAINT conauti_user_roles_pkey PRIMARY KEY (user_id, role_code);


--
-- Name: conauti_users conauti_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conauti_users
    ADD CONSTRAINT conauti_users_pkey PRIMARY KEY (id);


--
-- Name: conauti_users conauti_users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conauti_users
    ADD CONSTRAINT conauti_users_username_key UNIQUE (username);


--
-- Name: conauti_voice_preferences conauti_voice_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conauti_voice_preferences
    ADD CONSTRAINT conauti_voice_preferences_pkey PRIMARY KEY (user_id);


--
-- Name: conauti_voice_usage conauti_voice_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conauti_voice_usage
    ADD CONSTRAINT conauti_voice_usage_pkey PRIMARY KEY (id);


--
-- Name: idx_conauti_ai_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conauti_ai_user_date ON public.conauti_ai_requests USING btree (user_id, created_at DESC);


--
-- Name: idx_conauti_conversations_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conauti_conversations_user ON public.conauti_conversations USING btree (user_id, created_at DESC);


--
-- Name: idx_conauti_historial_orden; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conauti_historial_orden ON public.conauti_conversations USING btree (user_id, created_at DESC, id DESC);


--
-- Name: idx_conauti_memories_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conauti_memories_user ON public.conauti_memories USING btree (user_id);


--
-- Name: idx_conauti_mensajes_orden; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conauti_mensajes_orden ON public.conauti_messages USING btree (conversation_id, id DESC);


--
-- Name: idx_conauti_messages_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conauti_messages_conversation ON public.conauti_messages USING btree (conversation_id, id);


--
-- Name: idx_conauti_pedagogy_events; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conauti_pedagogy_events ON public.conauti_pedagogy_events USING btree (conversation_id, created_at DESC);


--
-- Name: idx_conauti_progress_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conauti_progress_user ON public.conauti_progress USING btree (user_id, recorded_at DESC);


--
-- Name: ix_conauti_assessment_history; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_conauti_assessment_history ON public.conauti_assessment_attempts USING btree (user_id, topic_key, answered_at DESC);


--
-- Name: ix_conauti_learning_topics_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_conauti_learning_topics_updated ON public.conauti_learning_topics USING btree (user_id, updated_at DESC);


--
-- Name: ix_conauti_voice_usage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_conauti_voice_usage ON public.conauti_voice_usage USING btree (user_id, created_at DESC);


--
-- Name: ux_conauti_assessment_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_conauti_assessment_pending ON public.conauti_assessment_attempts USING btree (user_id, topic_key) WHERE (answered_at IS NULL);


--
-- Name: conauti_users conauti_user_default_role; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER conauti_user_default_role AFTER INSERT ON public.conauti_users FOR EACH ROW EXECUTE FUNCTION public.conauti_default_role();


--
-- Name: conauti_ai_requests conauti_ai_requests_assistant_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conauti_ai_requests
    ADD CONSTRAINT conauti_ai_requests_assistant_message_id_fkey FOREIGN KEY (assistant_message_id) REFERENCES public.conauti_messages(id) ON DELETE CASCADE;


--
-- Name: conauti_ai_requests conauti_ai_requests_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conauti_ai_requests
    ADD CONSTRAINT conauti_ai_requests_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conauti_conversations(id) ON DELETE CASCADE;


--
-- Name: conauti_ai_requests conauti_ai_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conauti_ai_requests
    ADD CONSTRAINT conauti_ai_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.conauti_users(id) ON DELETE CASCADE;


--
-- Name: conauti_ai_requests conauti_ai_requests_user_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conauti_ai_requests
    ADD CONSTRAINT conauti_ai_requests_user_message_id_fkey FOREIGN KEY (user_message_id) REFERENCES public.conauti_messages(id) ON DELETE CASCADE;


--
-- Name: conauti_assessment_attempts conauti_assessment_attempts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conauti_assessment_attempts
    ADD CONSTRAINT conauti_assessment_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.conauti_users(id) ON DELETE CASCADE;


--
-- Name: conauti_conversations conauti_conversations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conauti_conversations
    ADD CONSTRAINT conauti_conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.conauti_users(id) ON DELETE CASCADE;


--
-- Name: conauti_learning_profiles conauti_learning_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conauti_learning_profiles
    ADD CONSTRAINT conauti_learning_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.conauti_users(id) ON DELETE CASCADE;


--
-- Name: conauti_learning_topics conauti_learning_topics_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conauti_learning_topics
    ADD CONSTRAINT conauti_learning_topics_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.conauti_users(id) ON DELETE CASCADE;


--
-- Name: conauti_memories conauti_memories_source_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conauti_memories
    ADD CONSTRAINT conauti_memories_source_message_id_fkey FOREIGN KEY (source_message_id) REFERENCES public.conauti_messages(id) ON DELETE SET NULL;


--
-- Name: conauti_memories conauti_memories_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conauti_memories
    ADD CONSTRAINT conauti_memories_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.conauti_users(id) ON DELETE CASCADE;


--
-- Name: conauti_messages conauti_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conauti_messages
    ADD CONSTRAINT conauti_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conauti_conversations(id) ON DELETE CASCADE;


--
-- Name: conauti_pedagogy_events conauti_pedagogy_events_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conauti_pedagogy_events
    ADD CONSTRAINT conauti_pedagogy_events_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conauti_conversations(id) ON DELETE CASCADE;


--
-- Name: conauti_pedagogy_events conauti_pedagogy_events_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conauti_pedagogy_events
    ADD CONSTRAINT conauti_pedagogy_events_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.conauti_messages(id) ON DELETE CASCADE;


--
-- Name: conauti_pedagogy_state conauti_pedagogy_state_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conauti_pedagogy_state
    ADD CONSTRAINT conauti_pedagogy_state_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conauti_conversations(id) ON DELETE CASCADE;


--
-- Name: conauti_progress conauti_progress_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conauti_progress
    ADD CONSTRAINT conauti_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.conauti_users(id) ON DELETE CASCADE;


--
-- Name: conauti_sessions conauti_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conauti_sessions
    ADD CONSTRAINT conauti_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.conauti_users(id) ON DELETE CASCADE;


--
-- Name: conauti_user_roles conauti_user_roles_role_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conauti_user_roles
    ADD CONSTRAINT conauti_user_roles_role_code_fkey FOREIGN KEY (role_code) REFERENCES public.conauti_roles(code);


--
-- Name: conauti_user_roles conauti_user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conauti_user_roles
    ADD CONSTRAINT conauti_user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.conauti_users(id) ON DELETE CASCADE;


--
-- Name: conauti_voice_preferences conauti_voice_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conauti_voice_preferences
    ADD CONSTRAINT conauti_voice_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.conauti_users(id) ON DELETE CASCADE;


--
-- Name: conauti_voice_usage conauti_voice_usage_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conauti_voice_usage
    ADD CONSTRAINT conauti_voice_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.conauti_users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict RzLEFdYV7cPOSmDVg4HfNTbOL4Ba8E40bvKoDi9JRcgzOjSLYBITM9yTc0tn38x

