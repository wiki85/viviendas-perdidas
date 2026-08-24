import { describe, expect, it } from 'vitest';
import { discoverListadoUrl } from './larioja-source.js';

/** Ancla real de la página del trámite (agosto de 2026), con el href antes
 * del title y las entidades del atributo sin decodificar. */
const REAL_ANCHOR =
  '<p><span style="font-size: large;"><a href="https://ias1.larioja.org/cex/sistemas/GenericoServlet?servlet=cex.sistemas.cmu.ImgServletSis&amp;code=GEEyL9CIKa%0AXfDfhBWKyA%3D%3D&amp;enc=" title="Abrir enlace">Listado de Viviendas autorizadas</a></span></p>';

describe('discoverListadoUrl', () => {
  it('extrae y decodifica el href del ancla real', () => {
    const url = discoverListadoUrl(REAL_ANCHOR);
    expect(url).toContain('cex.sistemas.cmu.ImgServletSis');
    expect(url).toContain('&code=');
    expect(url).not.toContain('&amp;');
  });

  it('sobrevive a atributos reordenados en el ancla', () => {
    const reordered =
      '<a title="Abrir enlace" href="https://ias1.larioja.org/cex/sistemas/GenericoServlet?servlet=cex.sistemas.cmu.ImgServletSis&amp;code=X">Listado de Viviendas autorizadas</a>';
    expect(discoverListadoUrl(reordered)).toContain('code=X');
  });

  it('cae al plan B del servlet si el texto del ancla cambia', () => {
    const renamed =
      '<a href="/cex/sistemas/GenericoServlet?servlet=cex.sistemas.cmu.ImgServletSis&amp;code=Y">Viviendas de uso turístico (listado)</a>';
    const url = discoverListadoUrl(renamed);
    expect(url).toBe(
      'https://web.larioja.org/cex/sistemas/GenericoServlet?servlet=cex.sistemas.cmu.ImgServletSis&code=Y',
    );
  });

  it('devuelve null ante una página sin el enlace (p. ej. un desafío del WAF)', () => {
    expect(discoverListadoUrl('<html><body>Just a moment...</body></html>')).toBeNull();
  });
});
